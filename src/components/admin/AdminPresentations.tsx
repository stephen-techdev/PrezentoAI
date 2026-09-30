import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, FileText } from 'lucide-react';
import { fetchAdminPresentations, type AdminPresentationRow } from '../../lib/admin';

export function AdminPresentations() {
  const [presentations, setPresentations] = useState<AdminPresentationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminPresentations(page, perPage, search);
    if (res.data) setPresentations(res.data);
    setTotal(res.total);
    setLoading(false);
  }, [page, perPage, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / perPage) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Presentations</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{total} total presentation{total !== 1 ? 's' : ''}</p>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(0); } }}
          placeholder="Search by title..."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Created Date</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-center">Slide Count</th>
                <th className="px-4 py-3 text-center">Theme</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : presentations.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No presentations found.</td></tr>
              ) : presentations.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white truncate max-w-[220px]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      {p.title || 'Untitled'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{p.user_name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">{p.total_slides}</td>
                  <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 capitalize">{p.theme || '—'}</td>
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
    </div>
  );
}
