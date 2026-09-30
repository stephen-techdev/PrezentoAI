import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Download, Activity, Loader2, Ban, CheckCircle } from 'lucide-react';
import { fetchAdminUserDetail, fetchUserPresentations, fetchUserActivity, setUserDisabled, type AdminUserRow, type AdminPresentationRow, type AdminActivityRow } from '../../lib/admin';

interface Props {
  userId: string;
  onBack: () => void;
}

export function AdminUserDetail({ userId, onBack }: Props) {
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [presentations, setPresentations] = useState<AdminPresentationRow[]>([]);
  const [activity, setActivity] = useState<AdminActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<boolean | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [userRes, presRes, actRes] = await Promise.allSettled([
        fetchAdminUserDetail(userId),
        fetchUserPresentations(userId),
        fetchUserActivity(userId),
      ]);
      if (userRes.status === 'fulfilled' && userRes.value.data) setUser(userRes.value.data);
      if (presRes.status === 'fulfilled' && presRes.value.data) setPresentations(presRes.value.data);
      if (actRes.status === 'fulfilled' && actRes.value.data) setActivity(actRes.value.data);
      setLoading(false);
    })();
  }, [userId]);

  const handleToggleDisable = async () => {
    if (!user || confirmAction === null) return;
    setActionLoading(true);
    await setUserDisabled(user.id, confirmAction);
    setActionLoading(false);
    setConfirmAction(null);
    const { data } = await fetchAdminUserDetail(userId);
    if (data) setUser(data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-slate-400">User not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-rose-600 hover:underline">← Back to users</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Users
      </button>

      {/* User header */}
      <div className="glass rounded-2xl p-6 border border-white/60 dark:border-slate-800/60 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-orange-500 flex items-center justify-center text-white text-xl font-semibold">
              {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{user.full_name || user.username || 'Unknown'}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email || 'No email'}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {user.role === 'admin' ? 'Administrator' : 'User'}
              </span>
              {user.is_disabled ? (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><Ban className="w-3 h-3" /> Disabled</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-3 h-3" /> Active</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setConfirmAction(!user.is_disabled)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${user.is_disabled ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
          >
            {user.is_disabled ? 'Enable Account' : 'Disable Account'}
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Registration Date" value={new Date(user.created_at).toLocaleDateString()} />
        <InfoCard label="Last Login" value={user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'} />
        <InfoCard label="Last Activity" value={user.last_activity ? new Date(user.last_activity).toLocaleString() : 'Never'} />
        <InfoCard label="Presentations Created" value={String(user.presentation_count)} icon={FileText} />
        <InfoCard label="PPTX Exports" value={String(user.pptx_exports)} icon={Download} />
        <InfoCard label="PDF Exports" value={String(user.pdf_exports)} icon={Download} />
      </div>

      {/* Presentations + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Presentations</h3>
          </div>
          {presentations.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No presentations yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {presentations.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <span className="text-slate-700 dark:text-slate-200 truncate font-medium">{p.title}</span>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h3>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No activity yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {activity.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                  <span className="text-slate-700 dark:text-slate-200">{formatAction(a.action)}</span>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">{new Date(a.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmAction !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="glass-strong rounded-2xl shadow-card-lg p-6 max-w-sm w-full border border-white/60 dark:border-slate-700/60">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
              {confirmAction ? 'Disable User' : 'Enable User'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {confirmAction
                ? `This will prevent ${user.full_name || user.email} from logging in.`
                : `This will allow ${user.full_name || user.email} to log in again.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
              <button
                onClick={handleToggleDisable}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${confirmAction ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmAction ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof FileText }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/60 dark:border-slate-800/60">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">{label}</span>
      </div>
      <div className="text-sm font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    login: 'Logged in',
    presentation_created: 'Created a presentation',
    presentation_edited: 'Edited a presentation',
    pptx_export: 'Exported PPTX',
    pdf_export: 'Exported PDF',
  };
  return map[action] || action;
}
