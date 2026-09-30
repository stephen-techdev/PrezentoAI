import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { Presentation, PresentationSettings } from './types';
import { apiGenerate, type ProgressCallback } from './lib/api';
import { useAuth } from './lib/auth';
import { savePresentation, getPresentation, deletePresentation } from './lib/presentationStore';
import { exportPPTX, exportPDF } from './lib/exporter';
import { AuthPage } from './components/AuthPage';
import { AdminLoginPage } from './components/AdminLoginPage';
import { Navbar, type NavPage } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { MyPresentations } from './components/MyPresentations';
import { ProfilePage } from './components/ProfilePage';
import { Landing } from './components/Landing';
import { SettingsPanel } from './components/SettingsPanel';
import { GeneratingScreen } from './components/GeneratingScreen';
import { Editor } from './components/Editor';
import { AdminNav, type AdminPage } from './components/admin/AdminNav';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminUserDetail } from './components/admin/AdminUserDetail';
import { AdminPresentations } from './components/admin/AdminPresentations';
import { AdminActivity } from './components/admin/AdminActivity';
import { AdminFeedback } from './components/admin/AdminFeedback';
import { AdminFeedbackDetail } from './components/admin/AdminFeedbackDetail';
import { AdminProfile } from './components/admin/AdminProfile';
import { FeedbackButton } from './components/FeedbackButton';
import { HelpGuide } from './components/HelpGuide';
import { trackVisit, logActivity, updateLastActivity } from './lib/admin';
import { loadThemeFonts } from './lib/fonts';
import { getTheme } from './themes';

type View = 'auth' | 'admin-login' | 'dashboard' | 'presentations' | 'create' | 'settings' | 'generating' | 'editor' | 'profile' | 'admin';

function parseHash(): { editorId: string | null } {
  const hash = window.location.hash.slice(1);
  const match = hash.match(/^editor\/(.+)$/);
  return { editorId: match ? match[1] : null };
}

function setEditorHash(id: string | null) {
  if (id) window.location.hash = `editor/${id}`;
  else if (parseHash().editorId) window.location.hash = '';
}

function App() {
  const { session, loading, profile } = useAuth();
  const [view, setView] = useState<View>('auth');
  const [dark, setDark] = useState(false);
  const [settings, setSettings] = useState<PresentationSettings | null>(null);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<string | undefined>(undefined);
  const [navPage, setNavPage] = useState<NavPage>('dashboard');
  const [editorLoading, setEditorLoading] = useState(false);
  const [startPresenting, setStartPresenting] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [adminPage, setAdminPage] = useState<AdminPage>('dashboard');
  const [helpOpen, setHelpOpen] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState<string | null>(null);
  const [adminSelectedFeedback, setAdminSelectedFeedback] = useState<string | null>(null);
  const initialRoutedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [dark]);

  // Lock page zoom: only the in-slide zoom controls may change magnification.
  // Blocks Ctrl/Cmd + (+/-/0), Ctrl + mouse wheel, and Safari pinch gestures.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '_', '0'].includes(e.key)) {
        e.preventDefault();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const onGesture = (e: Event) => e.preventDefault();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('gesturestart', onGesture);
    document.addEventListener('gesturechange', onGesture);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
    };
  }, []);

  // Dynamically load the theme's Google Fonts on demand (beyond the static
  // index.html set) whenever the open presentation's theme changes.
  useEffect(() => {
    if (!presentation) return;
    const theme = getTheme(presentation.settings.theme);
    loadThemeFonts(theme.headingFont, theme.bodyFont).catch(() => { /* fallback fonts apply */ });
  }, [presentation?.settings.theme, presentation?.id]);

  // Route based on auth state — users go to Dashboard.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      setView('auth');
      initialRoutedRef.current = false;
      return;
    }
    if (!initialRoutedRef.current) {
      if (profile === null) return;
      initialRoutedRef.current = true;
      if (profile.role === 'admin') {
        window.history.replaceState({}, '', '/admin');
        setView('admin');
        setAdminPage('dashboard');
      } else {
        if (window.location.pathname === '/admin') window.history.replaceState({}, '', '/');
        setView('dashboard');
        setNavPage('dashboard');
      }
    } else {
      setView((prev) => (prev === 'auth' ? (profile?.role === 'admin' ? 'admin' : 'dashboard') : prev));
    }
  }, [session, loading, profile]);

  // Hash-based routing: load presentation from URL on mount / hash change
  useEffect(() => {
    if (loading || !session) return;
    trackVisit();

    const { editorId } = parseHash();
    if (!editorId) return;

    // Already loaded this presentation — just switch to editor view
    if (presentation && presentation.id === editorId) {
      setView('editor');
      return;
    }

    // Load presentation from database
    setEditorLoading(true);
    getPresentation(editorId).then(({ data, error }) => {
      if (error || !data) {
        setGenError(error || 'Presentation not found');
        setEditorHash(null);
        setView('dashboard');
        setNavPage('dashboard');
        setEditorLoading(false);
        return;
      }
      setPresentation(data);
      setView('editor');
      setEditorLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  // Listen for back/forward navigation
  useEffect(() => {
    const onHashChange = () => {
      if (loading || !session) return;
      const { editorId } = parseHash();
      if (!editorId) {
        // Left the editor — go to dashboard
        if (view === 'editor') {
          setPresentation(null);
          setView('dashboard');
          setNavPage('dashboard');
        }
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [loading, session, view]);

  const handleGenerate = (s: PresentationSettings) => {
    setSettings(s);
    setView('settings');
  };

  const handleStartGeneration = () => {
    if (!settings) return;
    setGenError(null);
    setGenProgress(undefined);
    setView('generating');

    const onProgress: ProgressCallback = (msg) => setGenProgress(msg);

    apiGenerate(settings, onProgress)
      .then((pres) => {
        if (!pres.slides || pres.slides.length === 0) {
          setGenError('Generation produced no slides. Please try a different prompt.');
          setView('dashboard');
          return;
        }
        setPresentation(pres);
        setView('editor');
        setEditorHash(pres.id);
        savePresentation(pres).then(({ error: saveErr }) => {
          if (saveErr) {
            console.error('Save error:', saveErr);
          } else {
            logActivity('presentation_created', { title: pres.settings.title });
            updateLastActivity();
          }
        });
      })
      .catch((err) => {
        console.error('Generation error:', err);
        setGenError(
          err instanceof Error && err.message
            ? `We couldn't generate your presentation: ${err.message}`
            : "We couldn't generate your presentation. Please try again.",
        );
        setView('dashboard');
      });
  };

  const handleGenerationDone = () => {
    // No-op: generation is driven by the promise chain in handleStartGeneration.
  };

  const handleHome = useCallback(() => {
    window.history.pushState({}, '', '/');
    setView('dashboard');
    setNavPage('dashboard');
    setPresentation(null);
    setSettings(null);
    setStartPresenting(false);
    setEditorHash(null);
  }, []);

  const handleNavigate = (page: NavPage) => {
    setNavPage(page);
    setGenError(null);
    if (page === 'dashboard') {
      setView('dashboard');
      setEditorHash(null);
    } else if (page === 'presentations') {
      setView('presentations');
      setEditorHash(null);
    } else if (page === 'create') {
      setView('create');
      setSettings(null);
      setEditorHash(null);
    } else if (page === 'profile') {
      setView('profile');
      setEditorHash(null);
    }
  };

  const handleOpenPresentation = async (id: string) => {
    setGenError(null);
    setStartPresenting(false);
    setEditorLoading(true);
    const { data, error } = await getPresentation(id);
    if (error || !data) {
      setGenError('Could not open presentation: ' + (error || 'Not found'));
      setEditorLoading(false);
      return;
    }
    setPresentation(data);
    setView('editor');
    setEditorHash(id);
    setEditorLoading(false);
  };

  const handlePresent = async (id: string) => {
    setGenError(null);
    setStartPresenting(true);
    setEditorLoading(true);
    const { data, error } = await getPresentation(id);
    if (error || !data) {
      setGenError('Could not open presentation: ' + (error || 'Not found'));
      setStartPresenting(false);
      setEditorLoading(false);
      return;
    }
    setPresentation(data);
    setView('editor');
    setEditorHash(id);
    setEditorLoading(false);
  };

  const handleDownload = async (id: string, format: 'pptx' | 'pdf') => {
    setGenError(null);
    setDownloadLoading(id);
    try {
      const { data, error } = await getPresentation(id);
      if (error || !data) {
        setGenError('Could not load presentation for download: ' + (error || 'Not found'));
        return;
      }
      if (format === 'pptx') { await exportPPTX(data); logActivity('pptx_export', { title: data.settings.title }); }
      else { await exportPDF(data); logActivity('pdf_export', { title: data.settings.title }); }
    } catch (err) {
      setGenError('Download failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDownloadLoading(null);
    }
  };

  const handleDeletePresentation = async (id: string) => {
    setGenError(null);
    const { error } = await deletePresentation(id);
    if (error) {
      setGenError('Could not delete presentation: ' + error);
    }
  };

  // ── Loading screen ──
  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading Prezento AI...</p>
        </div>
      </div>
    );
  }

  // ── Auth screen (not logged in) ──
  if (!session) {
    if (view === 'admin-login') {
      return (
        <AdminLoginPage
          dark={dark}
          onToggleDark={() => setDark(!dark)}
          onBack={() => setView('auth')}
        />
      );
    }
    return (
      <AuthPage
        dark={dark}
        onToggleDark={() => setDark(!dark)}
        onAdminLogin={() => setView('admin-login')}
      />
    );
  }

  // ── Admin view ──
  if (view === 'admin' && profile?.role === 'admin') {
    return (
      <>
        <AdminNav
          current={adminPage}
          onNavigate={(p) => { setAdminPage(p); setAdminSelectedUser(null); setAdminSelectedFeedback(null); }}
          onExit={handleHome}
          onLogout={() => { window.history.replaceState({}, '', '/'); setView('admin-login'); }}
          dark={dark}
          onToggleDark={() => setDark(!dark)}
        />
        {adminPage === 'dashboard' && <AdminDashboard onNavigate={(p) => setAdminPage(p)} />}
        {adminPage === 'users' && !adminSelectedUser && (
          <AdminUsers onSelectUser={(id) => setAdminSelectedUser(id)} />
        )}
        {adminPage === 'users' && adminSelectedUser && (
          <AdminUserDetail userId={adminSelectedUser} onBack={() => setAdminSelectedUser(null)} />
        )}
        {adminPage === 'presentations' && <AdminPresentations />}
        {adminPage === 'activity' && <AdminActivity />}
        {adminPage === 'feedback' && !adminSelectedFeedback && (
          <AdminFeedback onSelectFeedback={(id) => setAdminSelectedFeedback(id)} />
        )}
        {adminPage === 'feedback' && adminSelectedFeedback && (
          <AdminFeedbackDetail feedbackId={adminSelectedFeedback} onBack={() => setAdminSelectedFeedback(null)} />
        )}
        {adminPage === 'profile' && <AdminProfile />}
      </>
    );
  }

  // If a non-admin somehow gets view=admin, redirect to dashboard
  if (view === 'admin' && profile?.role !== 'admin') {
    setView('dashboard');
    setNavPage('dashboard');
  }

  // ── Editor loading overlay ──
  if (editorLoading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Opening presentation...</p>
        </div>
      </div>
    );
  }

  // ── Editor view ──
  if (view === 'editor' && presentation) {
    return (
      <Editor
        presentation={presentation}
        onPresentationChange={setPresentation}
        onHome={handleHome}
        dark={dark}
        onToggleDark={() => setDark(!dark)}
        startPresenting={startPresenting}
      />
    );
  }

  // ── Settings view ──
  if (view === 'settings' && settings) {
    return (
      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        onGenerate={handleStartGeneration}
        onBack={handleHome}
      />
    );
  }

  // ── Generating view ──
  if (view === 'generating' && settings) {
    return <GeneratingScreen prompt={settings.prompt} progress={genProgress} onDone={handleGenerationDone} />;
  }

  // ── Create view (landing with generate) ──
  if (view === 'create') {
    return (
      <>
        {genError && <ErrorBanner message={genError} />}
        <Landing onGenerate={(s) => { setGenError(null); handleGenerate(s); }} onHelp={() => setHelpOpen(true)} dark={dark} onToggleDark={() => setDark(!dark)} />
        {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)} />}
      </>
    );
  }

  // ── Authenticated views with navbar ──
  const showNavbar = ['dashboard', 'presentations', 'profile'].includes(view);

  if (showNavbar) {
    return (
      <>
        {genError && <ErrorBanner message={genError} topOffset />}
        <Navbar current={navPage} onNavigate={handleNavigate} onHelp={() => setHelpOpen(true)} dark={dark} onToggleDark={() => setDark(!dark)} />
        {view === 'dashboard' && (
          <>
            <Dashboard onNavigate={handleNavigate} onOpenPresentation={handleOpenPresentation} onPresent={handlePresent} onDownload={handleDownload} onDelete={handleDeletePresentation} onHelp={() => setHelpOpen(true)} downloadLoading={downloadLoading} />
            <FeedbackButton />
          </>
        )}
        {view === 'presentations' && (
          <>
            <MyPresentations onNavigate={handleNavigate} onOpenPresentation={handleOpenPresentation} onPresent={handlePresent} onDownload={handleDownload} onDelete={handleDeletePresentation} downloadLoading={downloadLoading} />
            <FeedbackButton />
          </>
        )}
        {view === 'profile' && <ProfilePage />}
        {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)} />}
      </>
    );
  }

  // Fallback
  return (
    <>
      {genError && <ErrorBanner message={genError} />}
      <Landing onGenerate={(s) => { setGenError(null); handleGenerate(s); }} onHelp={() => setHelpOpen(true)} dark={dark} onToggleDark={() => setDark(!dark)} />
      {helpOpen && <HelpGuide onClose={() => setHelpOpen(false)} />}
    </>
  );
}

function ErrorBanner({ message, topOffset }: { message: string; topOffset?: boolean }) {
  return (
    <div className={`fixed ${topOffset ? 'top-20' : 'top-4'} left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4`}>
      <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300 shadow-lg">
        {message}
      </div>
    </div>
  );
}

export default App;
