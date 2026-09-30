import { useState, useRef, useEffect } from 'react';
import { Sparkles, LayoutDashboard, FolderOpen, Plus, User as UserIcon, LogOut, Sun, Moon, ChevronDown, HelpCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

export type NavPage = 'dashboard' | 'presentations' | 'create' | 'profile';

interface Props {
  current: NavPage;
  onNavigate: (page: NavPage) => void;
  onHelp: () => void;
  dark: boolean;
  onToggleDark: () => void;
}

export function Navbar({ current, onNavigate, onHelp, dark, onToggleDark }: Props) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = (profile?.full_name || profile?.username || profile?.email || 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const navItems: { id: NavPage; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'presentations', label: 'My Presentations', icon: FolderOpen },
    { id: 'create', label: 'Create', icon: Plus },
  ];

  return (
    <nav className="sticky top-0 z-40 glass-strong border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shadow-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="font-display font-bold text-lg leading-none">Prezento AI</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">AI Presentations</div>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                current === item.id
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onHelp}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="How to use Prezento"
          >
            <HelpCircle className="w-4 h-4" /> Guide
          </button>
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold">
                  {initials}
                </div>
              )}
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass-strong border border-slate-200/60 dark:border-slate-700/60 shadow-card-lg py-2 animate-fade-up">
                <div className="px-4 py-2 border-b border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {profile?.full_name || profile?.username || 'User'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {profile?.email}
                  </div>
                </div>
                <button
                  onClick={() => { onNavigate('profile'); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <UserIcon className="w-4 h-4" /> Profile
                </button>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              current === item.id
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
