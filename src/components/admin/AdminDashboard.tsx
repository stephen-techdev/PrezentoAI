import { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, Loader2, Activity, MessageSquare, BarChart3 } from 'lucide-react';
import {
  fetchAdminStats, fetchAdminActivity, fetchFeedbackCount,
  fetchRegistrationsChart, fetchPresentationsChart, fetchVisitorsChart,
  type AdminStats, type AdminActivityRow, type ChartPoint,
} from '../../lib/admin';

interface Props {
  onNavigate: (page: 'users' | 'presentations' | 'activity' | 'feedback') => void;
}

export function AdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminActivityRow[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [regChart, setRegChart] = useState<ChartPoint[]>([]);
  const [presChart, setPresChart] = useState<ChartPoint[]>([]);
  const [visChart, setVisChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [statsRes, actRes, fbRes, regRes, presRes, visRes] = await Promise.allSettled([
        fetchAdminStats(),
        fetchAdminActivity(8),
        fetchFeedbackCount(),
        fetchRegistrationsChart(14),
        fetchPresentationsChart(14),
        fetchVisitorsChart(14),
      ]);
      if (statsRes.status === 'fulfilled' && statsRes.value.data) setStats(statsRes.value.data);
      if (actRes.status === 'fulfilled' && actRes.value.data) setRecentActivity(actRes.value.data);
      if (fbRes.status === 'fulfilled') setFeedbackCount(fbRes.value.count);
      if (regRes.status === 'fulfilled' && regRes.value.data) setRegChart(regRes.value.data);
      if (presRes.status === 'fulfilled' && presRes.value.data) setPresChart(presRes.value.data);
      if (visRes.status === 'fulfilled' && visRes.value.data) setVisChart(visRes.value.data);
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

  const cards = [
    { label: 'Registered Users', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/30' },
    { label: 'Total Presentations', value: stats?.totalPresentations ?? 0, icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Feedback', value: feedbackCount, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white mb-1">Admin Dashboard</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Overview of platform activity and statistics</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-display font-bold text-slate-900 dark:text-white">{card.value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{card.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics charts (last 14 days) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <MiniBarChart title="Registrations" points={regChart} color="#f43f5e" />
        <MiniBarChart title="Presentations created" points={presChart} color="#6366f1" />
        <MiniBarChart title="Visits" points={visChart} color="#10b981" />
      </div>

      {/* Recent activity list */}
      <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h3>
          </div>
          <button
            onClick={() => onNavigate('feedback')}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline"
          >
            View feedback →
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="text-slate-700 dark:text-slate-200 font-medium truncate">{a.user_name}</span>
                <span className="text-slate-500 dark:text-slate-400 truncate">{formatAction(a.action)}</span>
                <span className="text-xs text-slate-400 ml-auto shrink-0">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBarChart({ title, points, color }: { title: string; points: ChartPoint[]; color: string }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div className="glass rounded-2xl p-5 border border-white/60 dark:border-slate-800/60">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4" style={{ color }} />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
        <span className="text-[11px] text-slate-400 ml-auto">14 days</span>
      </div>
      {points.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No data yet.</p>
      ) : (
        <div className="flex items-end gap-1 h-24">
          {points.map((p) => (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${p.date}: ${p.count}`}>
              <div
                className="w-full rounded-t transition-all"
                style={{ height: `${Math.max(4, (p.count / max) * 80)}px`, background: color, opacity: 0.85 }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
        <span>{points[0]?.date?.slice(5) || ''}</span>
        <span className="font-semibold" style={{ color }}>
          {points.reduce((a, p) => a + p.count, 0)} total
        </span>
        <span>{points[points.length - 1]?.date?.slice(5) || ''}</span>
      </div>
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    login: 'logged in',
    presentation_created: 'created a presentation',
    presentation_edited: 'edited a presentation',
    pptx_export: 'exported PPTX',
    pdf_export: 'exported PDF',
  };
  return map[action] || action;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
