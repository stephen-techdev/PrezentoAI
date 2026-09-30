import { useState, useEffect, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, Ban, CheckCircle, Eye, Trash2, Shield } from 'lucide-react';
import { fetchAdminUsers, setUserDisabled, setUserRole, deleteUserAccount, type AdminUserRow } from '../../lib/admin';

interface Props {
  onSelectUser: (userId: string) => void;
}

type SortField = 'created_at' | 'full_name' | 'email' | 'last_login' | 'last_activity';
type StatusFilter = 'all' | 'active' | 'disabled';

export function AdminUsers({ onSelectUser }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(10);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [confirmAction, setConfirmAction] = useState<
    { user: AdminUserRow; type: 'disable' | 'role' | 'delete' } | null
  >(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, total: t, error: err } = await fetchAdminUsers(page, perPage, search, sortBy, sortAsc, statusFilter);
    if (err) {
      setUsers([]);
      setTotal(0);
    } else {
      setUsers(data || []);
      setTotal(t);
    }
    setLoading(false);
  }, [page, perPage, search, sortBy, sortAsc, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortAsc(!sortAsc);
    else { setSortBy(field); setSortAsc(true); }
    setPage(0);
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(0);
  };

  const totalPages = Math.ceil(total / perPage) || 1;

  const sortIcon = (field: SortField) => {
    if (sortBy !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    if (confirmAction.type === 'disable') {
      await setUserDisabled(confirmAction.user.id, !confirmAction.user.is_disabled);
    } else if (confirmAction.type === 'role') {
      await setUserRole(confirmAction.user.id, confirmAction.user.role === 'admin' ? 'user' : 'admin');
    } else if (confirmAction.type === 'delete') {
      await deleteUserAccount(confirmAction.user.id);
    }
    setActionLoading(false);
    setConfirmAction(null);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Users</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">{total} registered user{total !== 1 ? 's' : ''}</p>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, email, or username..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
        >
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/60 dark:border-slate-800/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs text-slate-500 dark:text-slate-400 uppercase">
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('full_name')}>
                  <div className="flex items-center gap-1">Name {sortIcon('full_name')}</div>
                </th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('email')}>
                  <div className="flex items-center gap-1">Email {sortIcon('email')}</div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('created_at')}>
                  <div className="flex items-center gap-1">Created {sortIcon('created_at')}</div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200" onClick={() => handleSort('last_login')}>
                  <div className="flex items-center gap-1">Last Login {sortIcon('last_login')}</div>
                </th>
                <th className="px-4 py-3 text-center">Presentations</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Role</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No users found.</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3">
                    <button onClick={() => onSelectUser(u.id)} className="flex items-center gap-2 text-left hover:text-rose-600 dark:hover:text-rose-400">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-semibold">
                          {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-slate-900 dark:text-white truncate">{u.full_name || 'Unknown'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{u.username ? `@${u.username}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[180px]">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never logged in'}</td>
                  <td className="px-4 py-3 text-center font-medium text-slate-900 dark:text-white">{u.presentation_count}</td>
                  <td className="px-4 py-3 text-center">
                    {u.is_disabled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><Ban className="w-3 h-3" /> Disabled</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle className="w-3 h-3" /> Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400"><Shield className="w-3 h-3" /> Admin</span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onSelectUser(u.id)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmAction({ user: u, type: 'role' })}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-rose-600 transition"
                        title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmAction({ user: u, type: 'disable' })}
                        className={`p-1.5 rounded-lg transition ${u.is_disabled ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                        title={u.is_disabled ? 'Enable user' : 'Disable user'}
                      >
                        {u.is_disabled ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirmAction({ user: u, type: 'delete' })}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
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
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Page {page + 1} of {totalPages} · {total} total
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="glass-strong rounded-2xl shadow-card-lg p-6 max-w-sm w-full border border-white/60 dark:border-slate-700/60">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-2">
              {confirmAction.type === 'delete' ? 'Delete User' : confirmAction.type === 'role' ? 'Change Role' : confirmAction.user.is_disabled ? 'Enable User' : 'Disable User'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {confirmAction.type === 'delete'
                ? `This will permanently delete ${confirmAction.user.full_name || confirmAction.user.email} and all their presentations. This cannot be undone.`
                : confirmAction.type === 'role'
                ? `${confirmAction.user.role === 'admin' ? 'Demote' : 'Promote'} ${confirmAction.user.full_name || confirmAction.user.email} ${confirmAction.user.role === 'admin' ? 'to regular user' : 'to admin'}.`
                : confirmAction.user.is_disabled
                ? `This will allow ${confirmAction.user.full_name || confirmAction.user.email} to log in again.`
                : `This will prevent ${confirmAction.user.full_name || confirmAction.user.email} from logging in.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 ${
                  confirmAction.type === 'delete' ? 'bg-red-500 hover:bg-red-600'
                  : confirmAction.type === 'role' ? 'bg-rose-500 hover:bg-rose-600'
                  : confirmAction.user.is_disabled ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmAction.type === 'delete' ? 'Delete' : confirmAction.type === 'role' ? 'Change' : confirmAction.user.is_disabled ? 'Enable' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
