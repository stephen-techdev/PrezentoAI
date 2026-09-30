import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Mail, Lock, User, Image as ImageIcon, Loader2, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { checkLoginAttempt, recordFailedLogin, resetLoginAttempts, formatLockoutTime } from '../lib/loginAttempts';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  onAdminLogin: () => void;
}

export type AuthMode = 'login' | 'register';
type Mode = AuthMode;

export function AuthPage({ dark, onToggleDark, onAdminLogin }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile picture must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!email || !password || !confirmPassword || !fullName || !username || !gender) {
        setError('All fields are required');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Email and password are required');
        return;
      }
    }

    if (mode === 'login') {
      // Check lockout status before attempting login
      const status = await checkLoginAttempt(email);
      if (status.locked) {
        setLockoutUntil(status.locked_until);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { error: err } = await signUp(email, password, fullName, username, gender, avatarUrl);
        if (err) {
          if (err.includes('already registered') || err.includes('already been registered') || err.includes('already in use')) {
            setError('This email is already registered. Try logging in instead.');
          } else if (err.includes('username') && (err.includes('unique') || err.includes('duplicate') || err.includes('exists'))) {
            setError('This username is already taken. Please choose a different one.');
          } else if (err.includes('weak')) {
            setError('Password is too weak. Please choose a stronger password.');
          } else if (err.includes('Database error') || err.includes('saving new user')) {
            setError('Unable to create account. Please check your information and try again.');
          } else {
            setError(err);
          }
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          if (err.includes('Invalid login')) {
            // Record the failed attempt server-side
            const failStatus = await recordFailedLogin(email);
            if (failStatus.locked) {
              setLockoutUntil(failStatus.locked_until);
            } else {
              setError(`Incorrect email or password. ${failStatus.remaining_attempts} attempt${failStatus.remaining_attempts !== 1 ? 's' : ''} remaining.`);
            }
          } else if (err.toLowerCase().includes('disabled')) {
            setError('This account has been disabled. Contact an administrator.');
          } else {
            setError(err);
          }
        } else {
          // Successful login — reset attempts
          await resetLoginAttempts(email);
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Prezento AI</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-0.5">AI Presentations</div>
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
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {mode === 'login' ? 'Sign in to continue to Prezento' : 'Join Prezento to start creating presentations'}
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
            {mode === 'register' && (
              <>
                {/* Profile picture */}
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-slate-300 dark:border-slate-600 hover:border-brand-400 transition shrink-0"
                  >
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="text-sm text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Upload profile picture
                    </button>
                    <p className="text-xs text-slate-400 mt-0.5">Optional, max 2MB</p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>

                {/* Full name + username */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                        placeholder="janedoe"
                      />
                    </div>
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!lockoutUntil && mode === 'login'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-60"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!!lockoutUntil && mode === 'login'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-60"
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

            {/* Confirm password */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!!lockoutUntil && mode === 'login')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-500 text-white font-medium shadow-glow hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : (
                <>{mode === 'login' ? 'Sign In' : 'Create Account'}</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            {mode === 'login' ? (
              <p className="text-slate-500 dark:text-slate-400">
                Don't have an account?{' '}
                <button onClick={() => { setMode('register'); setError(null); }} className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Sign up
                </button>
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(null); }} className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </div>

          {mode === 'login' && (
            <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
              <button
                type="button"
                onClick={onAdminLogin}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Access
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
