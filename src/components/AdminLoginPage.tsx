import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Mail, Lock, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { checkLoginAttempt, recordFailedLogin, resetLoginAttempts, formatLockoutTime } from '../lib/loginAttempts';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  onBack: () => void;
}

export function AdminLoginPage({ dark, onToggleDark, onBack }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<string | null>(null);

  const updateLockoutDisplay = useCallback(() => {
    if (!lockoutUntil) return;
    const timeStr = formatLockoutTime(lockoutUntil);
    setError(`Account temporarily locked. Try again in ${timeStr}.`);
  }, [lockoutUntil]);

  useEffect(() => {
    if (!lockoutUntil) return;
    updateLockoutDisplay();
    const interval = setInterval(updateLockoutDisplay, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, updateLockoutDisplay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    // Check lockout status before attempting
    const status = await checkLoginAttempt(email);
    if (status.locked) {
      setLockoutUntil(status.locked_until);
      return;
    }

    setLoading(true);
    try {
      const { error: signInErr } = await signIn(email, password);
      if (signInErr) {
        if (signInErr.toLowerCase().includes('disabled')) {
          setError('This account has been disabled. Contact an administrator.');
          return;
        }

        // Record the failed attempt
        const failStatus = await recordFailedLogin(email);

        if (failStatus.locked) {
          setLockoutUntil(failStatus.locked_until);
        } else {
          setError(`Incorrect email or password. ${failStatus.remaining_attempts} attempt${failStatus.remaining_attempts !== 1 ? 's' : ''} remaining.`);
        }
        return;
      }

      // Verify the authenticated user is actually an admin
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('Authentication succeeded but no session was found. Please try again.');
        return;
      }
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, is_disabled')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileErr) {
        await supabase.auth.signOut();
        setError('Could not verify admin role. Please try again.');
        return;
      }
      if (!profile) {
        await supabase.auth.signOut();
        setError('No profile found for this account. Contact an administrator.');
        return;
      }
      if (profile.is_disabled) {
        await supabase.auth.signOut();
        setError('This account has been disabled. Contact an administrator.');
        return;
      }
      if (profile.role !== 'admin') {
        await supabase.auth.signOut();
        // Record failed attempt for non-admin trying to access admin portal
        await recordFailedLogin(email);
        setError('Authentication succeeded, but this account does not have administrator privileges.');
        return;
      }

      // Successful admin login — reset attempts
      await resetLoginAttempts(email);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-glow">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Admin Portal</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">Prezento Administration</div>
            </div>
          </div>
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl shadow-card-lg p-6 sm:p-8 border border-white/60 dark:border-slate-700/60">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Admin Sign In
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 ml-11">
            Restricted access — administrators only
          </p>

          {error && (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              lockoutUntil
                ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  disabled={!!lockoutUntil}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition disabled:opacity-60"
                  placeholder="stephen@prezento.app"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={!!lockoutUntil}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition disabled:opacity-60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !!lockoutUntil}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-medium shadow-glow hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to User Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
