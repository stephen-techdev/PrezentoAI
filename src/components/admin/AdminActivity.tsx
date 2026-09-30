import { useState, useEffect } from 'react';
import { Loader2, Activity as ActivityIcon, Shield } from 'lucide-react';
import { fetchAdminActivity, fetchAdminAuditLogs } from '../../lib/admin';

type ActivityEntry = {
  id: string;
  date: string;
  user: string;
  action: string;
  description: string;
  source: 'user' | 'admin';
};

export function AdminActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [actRes, auditRes] = await Promise.allSettled([
        fetchAdminActivity(50),
        fetchAdminAuditLogs(50),
      ]);
      const userActivity: ActivityEntry[] = [];
      if (actRes.status === 'fulfilled' && actRes.value.data) {
        for (const a of actRes.value.data) {
          userActivity.push({
            id: a.id,
            date: a.created_at,
            user: a.user_name,
            action: formatAction(a.action),
            description: a.details ? JSON.stringify(a.details).slice(0, 80) : '—',
            source: 'user',
          });
        }
      }
      const auditEntries: ActivityEntry[] = [];
      if (auditRes.status === 'fulfilled' && auditRes.value.data) {
        for (const a of auditRes.value.data) {
          auditEntries.push({
            id: a.id,
            date: a.created_at,
            user: a.admin_name,
            action: formatAuditAction(a.action),
            description: a.target_name ? `Target: ${a.target_name}` : '—',
            source: 'admin',
          });
        }
      }
      const combined = [...userActivity, ...auditEntries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEntries(combined);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Activity</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Chronological log of user and admin actions</p>

      <div className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Date &amp; Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No activity recorded yet.</td></tr>
              ) : entries.map((e) => (
                <tr key={`${e.source}-${e.id}`} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(e.date).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{e.user}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{e.action}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{e.description}</td>
                  <td className="px-4 py-3 text-center">
                    {e.source === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <ActivityIcon className="w-3 h-3" /> User
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    login: 'User logged in',
    presentation_created: 'Presentation created',
    presentation_edited: 'Presentation edited',
    pptx_export: 'Presentation exported (PPTX)',
    pdf_export: 'Presentation exported (PDF)',
  };
  return map[action] || action;
}

function formatAuditAction(action: string): string {
  const map: Record<string, string> = {
    admin_login: 'Admin logged in',
    user_viewed: 'User viewed',
    user_enabled: 'User enabled',
    user_disabled: 'User disabled',
    user_role_changed: 'User role changed',
    user_deleted: 'User deleted',
  };
  return map[action] || action;
}
