import { useEffect, useState } from 'react';
import { Sparkles, Plus, FileText, Clock, TrendingUp, HelpCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { listPresentations, renamePresentation, duplicatePresentation, type PresentationRow } from '../lib/presentationStore';
import { PresentationCard } from './PresentationCard';
import type { NavPage } from './Navbar';

interface Props {
  onNavigate: (page: NavPage) => void;
  onOpenPresentation: (id: string) => void;
  onPresent: (id: string) => void;
  onDownload: (id: string, format: 'pptx' | 'pdf') => void;
  onDelete: (id: string) => void;
  onHelp: () => void;
  downloadLoading: string | null;
}

export function Dashboard({ onNavigate, onOpenPresentation, onPresent, onDownload, onDelete, onHelp, downloadLoading }: Props) {
  const { profile } = useAuth();
  const [presentations, setPresentations] = useState<PresentationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await listPresentations();
      setPresentations(data || []);
      setLoading(false);
    })();
  }, []);

  const recent = presentations.slice(0, 4);

  const reload = async () => {
    const { data } = await listPresentations();
    setPresentations(data || []);
  };

  return (
    <div className="min-h-screen mesh-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
              Welcome back, {profile?.full_name || profile?.username || 'there'}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Create a new presentation or continue working on an existing one.
            </p>
          </div>
          <button
            onClick={onHelp}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all shrink-0"
          >
            <HelpCircle className="w-4 h-4" /> How to use Prezento
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">{presentations.length}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Presentations</div>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {presentations.reduce((sum, p) => sum + p.total_slides, 0)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Slides</div>
              </div>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  {recent[0] ? new Date(recent[0].updated_at).toLocaleDateString() : '—'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Last Edited</div>
              </div>
            </div>
          </div>
        </div>

        {/* Create new */}
        <button
          onClick={() => onNavigate('create')}
          className="w-full mb-8 group glass-strong rounded-2xl p-6 border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 transition-all hover:shadow-card text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shadow-glow group-hover:scale-110 transition-transform">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Create New Presentation</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Generate a professional slide deck with AI</p>
            </div>
            <Sparkles className="w-5 h-5 text-brand-400 ml-auto group-hover:rotate-12 transition-transform" />
          </div>
        </button>

        {/* Recent presentations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Recent Presentations</h2>
            {presentations.length > 0 && (
              <button
                onClick={() => onNavigate('presentations')}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
              >
                View all
              </button>
            )}
          </div>

          {loading ? (
            <div className="glass rounded-2xl p-8 text-center text-slate-400 border border-white/60 dark:border-slate-800/60">
              Loading...
            </div>
          ) : recent.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-white/60 dark:border-slate-800/60">
              <FileText className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 mb-4">No presentations yet</p>
              <button
                onClick={() => onNavigate('create')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-sm font-medium shadow-glow hover:shadow-lg transition-all"
              >
                <Plus className="w-4 h-4" /> Create your first presentation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recent.map((p) => (
                <PresentationCard
                  key={p.id}
                  presentation={p}
                  onOpen={onOpenPresentation}
                  onPresent={onPresent}
                  onDownload={onDownload}
                  onDelete={async (id) => { await onDelete(id); await reload(); }}
                  onRename={async (id, title) => { await renamePresentation(id, title); await reload(); }}
                  onDuplicate={async (id) => { await duplicatePresentation(id); await reload(); }}
                  busy={downloadLoading === p.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
