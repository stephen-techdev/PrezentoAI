import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { fetchAllFeedback, deleteFeedback, type FeedbackRow, type FeedbackStatus } from '../../lib/admin';

interface Props {
  onSelectFeedback: (id: string) => void;
  onFeedbackChanged?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-amber-600 dark:text-amber-400',
  in_progress: 'text-sky-600 dark:text-sky-400',
  resolved: 'text-emerald-600 dark:text-emerald-400',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const TYPE_LABELS: Record<string, string> = {
  general: 'General Feedback',
  problem: 'Report a Problem',
  bug: 'Bug Report',
  feature_request: 'Feature Request',
  other: 'Other',
};

export function AdminFeedback({ onSelectFeedback, onFeedbackChanged }: Props) {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'all' | FeedbackStatus>('all');
  const [deleteTarget, setDeleteTarget] = useState<FeedbackRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, total: t } = await fetchAllFeedback(page, perPage, statusFilter);
    setFeedback(data || []);
    setTotal(t);
    setLoading(false);
  }, [page, perPage, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / perPage) || 1;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteFeedback(deleteTarget.id);
    setDeleting(false);
    if (error) return;
    setDeleteTarget(null);
    load();
    onFeedbackChanged?.();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Feedback</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{total} feedback message{total !== 1 ? 's' : ''}</p>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as 'all' | FeedbackStatus); setPage(0); }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Message Preview</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : feedback.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No feedback found.</td></tr>
              ) : feedback.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{f.user_name || 'Unknown'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{f.user_email || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{TYPE_LABELS[f.feedback_type] || f.feedback_type}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{f.message.slice(0, 60)}{f.message.length > 60 ? '...' : ''}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(f.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${STATUS_COLORS[f.status] || 'text-slate-500'}`}>
                      {STATUS_LABELS[f.status] || f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-3">
                      <button
                        onClick={() => onSelectFeedback(f.id)}
                        className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => setDeleteTarget(f)}
                        className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="glass-strong rounded-2xl shadow-card-lg max-w-sm w-full border border-white/60 dark:border-slate-700/60 p-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">Delete this feedback?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              Are you sure you want to permanently delete this feedback from <span className="font-medium">{deleteTarget.user_name || deleteTarget.user_email}</span>? All conversation messages will also be removed.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
