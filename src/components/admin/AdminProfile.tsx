import { useState, useRef } from 'react';
import { UserCircle, Mail, Lock, Loader2, Save, X, CheckCircle, Camera, ShieldCheck, Calendar, AtSign, User } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

export function AdminProfile() {
  const { profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change email state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const initials = (profile.full_name || profile.username || profile.email || 'A')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  const startEdit = () => {
    setEditName(profile.full_name || '');
    setEditUsername(profile.username || '');
    setEditAvatar(profile.avatar_url || '');
    setProfileMsg(null);
    setEditing(true);
  };

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image must be under 2MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setProfileMsg({ type: 'error', text: 'Full name cannot be empty' });
      return;
    }
    if (!editUsername.trim()) {
      setProfileMsg({ type: 'error', text: 'Username cannot be empty' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          username: editUsername.trim(),
          avatar_url: editAvatar || null,
        })
        .eq('id', profile.id);
      if (error) {
        if (error.message.includes('username') && (error.message.includes('unique') || error.message.includes('duplicate'))) {
          setProfileMsg({ type: 'error', text: 'This username is already taken.' });
        } else {
          setProfileMsg({ type: 'error', text: error.message });
        }
        setSavingProfile(false);
        return;
      }
      await refreshProfile();
      setEditing(false);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch {
      setProfileMsg({ type: 'error', text: 'An unexpected error occurred.' });
    }
    setSavingProfile(false);
  };

  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'All fields are required.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordMsg({ type: 'error', text: 'New password must be different from the current password.' });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMsg({ type: 'error', text: 'Failed to change password. Please try again.' });
        setChangingPassword(false);
        return;
      }
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch {
      setPasswordMsg({ type: 'error', text: 'An unexpected error occurred.' });
    }
    setChangingPassword(false);
  };

  const handleChangeEmail = async () => {
    setEmailMsg(null);
    if (!newEmail.trim()) {
      setEmailMsg({ type: 'error', text: 'Email cannot be empty.' });
      return;
    }
    if (newEmail.trim() === profile.email) {
      setEmailMsg({ type: 'error', text: 'New email must be different from current email.' });
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        setEmailMsg({ type: 'error', text: error.message || 'Failed to change email.' });
        setChangingEmail(false);
        return;
      }
      // Update profile table too
      await supabase
        .from('profiles')
        .update({ email: newEmail.trim() })
        .eq('id', profile.id);
      await refreshProfile();
      setEmailMsg({ type: 'success', text: 'Email change initiated. If email verification is enabled, check your inbox to confirm the new email.' });
      setNewEmail('');
      setShowEmailForm(false);
    } catch {
      setEmailMsg({ type: 'error', text: 'An unexpected error occurred.' });
    }
    setChangingEmail(false);
  };

  const passwordChecks = [
    { label: 'At least 8 characters', pass: newPassword.length >= 8 },
    { label: 'Passwords match', pass: newPassword.length > 0 && newPassword === confirmPassword },
    { label: 'Different from current', pass: newPassword.length > 0 && newPassword !== currentPassword },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Admin Profile</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Manage your administrator account</p>

      {/* Profile Card */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            {editing ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-rose-300 dark:border-rose-600 hover:border-rose-500 transition group"
              >
                {editAvatar ? (
                  <img src={editAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-rose-500 transition" />
                    <span className="text-[10px] text-slate-400">Change</span>
                  </div>
                )}
              </div>
            ) : profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-slate-200 dark:border-slate-700">
                {initials}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Info / Edit fields */}
          <div className="flex-1 w-full">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                      placeholder="Full name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                      placeholder="username"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button
                    onClick={() => { setEditing(false); setProfileMsg(null); }}
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{profile.full_name || 'Administrator'}</h2>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                    Administrator
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <AtSign className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{profile.username || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{profile.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Administrator</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                  >
                    <UserCircle className="w-4 h-4" /> Edit Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {profileMsg && (
          <div className={`mt-4 rounded-lg px-4 py-2.5 text-sm ${
            profileMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {profileMsg.text}
          </div>
        )}
      </div>

      {/* Change Email */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email Address</h3>
          </div>
          {!showEmailForm && (
            <button
              onClick={() => { setShowEmailForm(true); setNewEmail(''); setEmailMsg(null); }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
            >
              Change Email
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">{profile.email}</p>
        {showEmailForm && (
          <div className="mt-3 space-y-3">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
              placeholder="new.email@example.com"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowEmailForm(false); setEmailMsg(null); }}
                disabled={changingEmail}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeEmail}
                disabled={changingEmail}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50"
              >
                {changingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Update Email
              </button>
            </div>
          </div>
        )}
        {emailMsg && (
          <div className={`mt-3 rounded-lg px-4 py-2.5 text-sm ${
            emailMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {emailMsg.text}
          </div>
        )}
      </div>

      {/* Security — Change Password */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Security</h3>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => { setShowPasswordForm(true); setPasswordMsg(null); }}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
            >
              Change Password
            </button>
          )}
        </div>

        {!showPasswordForm ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {passwordMsg?.type === 'success' ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" /> {passwordMsg.text}
              </span>
            ) : (
              'Change your account password to keep your account secure.'
            )}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                placeholder="••••••••"
              />
            </div>
            {/* Password validation indicators */}
            <div className="space-y-1">
              {passwordChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className={`w-3.5 h-3.5 ${check.pass ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                  <span className={check.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>{check.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button
                onClick={() => { setShowPasswordForm(false); setPasswordMsg(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                disabled={changingPassword}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-50"
              >
                {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Change Password
              </button>
            </div>
          </div>
        )}
        {passwordMsg && passwordMsg.type === 'error' && (
          <div className="mt-3 rounded-lg px-4 py-2.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            {passwordMsg.text}
          </div>
        )}
      </div>
    </div>
  );
}
