import { supabase } from './supabase';

// ── Visitor tracking ──────────────────────────────────────────────────────────

const VISITOR_ID_KEY = 'prezento_visitor_id';

function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

export function trackVisit(path?: string): void {
  const visitorId = getOrCreateVisitorId();
  supabase
    .from('visitor_events')
    .insert({ visitor_id: visitorId, path: path || window.location.pathname })
    .then(() => {});
}

// ── Activity logging ──────────────────────────────────────────────────────────

export async function logActivity(action: string, details?: Record<string, unknown>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase
    .from('activity_logs')
    .insert({ user_id: session.user.id, action, details: details || null });
}

export async function updateLastActivity(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  supabase
    .from('profiles')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', session.user.id)
    .then(() => {});
}

export async function logAdminAction(
  action: string,
  targetUserId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase
    .from('admin_audit_logs')
    .insert({ admin_id: session.user.id, action, target_user_id: targetUserId, details: details || null });
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  is_disabled: boolean;
  last_login: string | null;
  last_activity: string | null;
  created_at: string;
  presentation_count: number;
  pptx_exports: number;
  pdf_exports: number;
}

export interface AdminPresentationRow {
  id: string;
  user_id: string;
  title: string;
  theme: string | null;
  total_slides: number;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_name: string;
}

export interface AdminActivityRow {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_email: string | null;
  user_name: string;
}

export interface AdminAuditLogRow {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  admin_name: string;
  target_name: string | null;
}

export interface AdminStats {
  totalVisitors: number;
  uniqueVisitors: number;
  visitorsToday: number;
  visitorsThisWeek: number;
  visitorsThisMonth: number;
  totalUsers: number;
  totalPresentations: number;
  pptxExports: number;
  pdfExports: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  presentationsToday: number;
  presentationsThisWeek: number;
  presentationsThisMonth: number;
}

export async function fetchAdminStats(): Promise<{ data: AdminStats | null; error: string | null }> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const results = await Promise.allSettled([
      supabase.from('visitor_events').select('*', { count: 'exact', head: true }),
      supabase.from('visitor_events').select('visitor_id'),
      supabase.from('visitor_events').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('visitor_events').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('visitor_events').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('presentations').select('*', { count: 'exact', head: true }),
      supabase.from('presentations').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('presentations').select('*', { count: 'exact', head: true }).gte('created_at', weekStart),
      supabase.from('presentations').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action', 'pptx_export'),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('action', 'pdf_export'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('last_activity', 'is', null).gte('last_activity', weekStart),
    ]);

    const v = (i: number) => results[i].status === 'fulfilled' ? (results[i].value as { count: number | null }) : { count: 0 };
    const uniqueVisitorSet = results[1].status === 'fulfilled'
      ? new Set((results[1].value as { data: { visitor_id: string }[] | null }).data?.map((x: { visitor_id: string }) => x.visitor_id) || [])
      : new Set<string>();

    const stats: AdminStats = {
      totalVisitors: v(0).count || 0,
      uniqueVisitors: uniqueVisitorSet.size,
      visitorsToday: v(2).count || 0,
      visitorsThisWeek: v(3).count || 0,
      visitorsThisMonth: v(4).count || 0,
      totalUsers: v(5).count || 0,
      totalPresentations: v(9).count || 0,
      pptxExports: v(13).count || 0,
      pdfExports: v(14).count || 0,
      activeUsers: v(15).count || 0,
      newUsersToday: v(6).count || 0,
      newUsersThisWeek: v(7).count || 0,
      newUsersThisMonth: v(8).count || 0,
      presentationsToday: v(10).count || 0,
      presentationsThisWeek: v(11).count || 0,
      presentationsThisMonth: v(12).count || 0,
    };

    return { data: stats, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load stats' };
  }
}

export async function fetchAdminUsers(
  page: number,
  perPage: number,
  search: string,
  sortBy: string,
  sortAsc: boolean,
  statusFilter: 'all' | 'active' | 'disabled',
): Promise<{ data: AdminUserRow[] | null; total: number; error: string | null }> {
  try {
    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    if (statusFilter === 'active') query = query.eq('is_disabled', false);
    else if (statusFilter === 'disabled') query = query.eq('is_disabled', true);

    const validSorts = ['created_at', 'full_name', 'email', 'last_login', 'last_activity'];
    const sortColumn = validSorts.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(sortColumn, { ascending: sortAsc });

    const from = page * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data: profiles, count, error } = await query;
    if (error) return { data: null, total: 0, error: error.message };
    if (!profiles || profiles.length === 0) return { data: [], total: count || 0, error: null };

    // Get presentation counts and export counts for each user
    const userIds = profiles.map((p: { id: string }) => p.id);
    const [presCounts, pptxCounts, pdfCounts] = await Promise.allSettled([
      supabase.from('presentations').select('user_id').in('user_id', userIds),
      supabase.from('activity_logs').select('user_id').eq('action', 'pptx_export').in('user_id', userIds),
      supabase.from('activity_logs').select('user_id').eq('action', 'pdf_export').in('user_id', userIds),
    ]);

    const presData = presCounts.status === 'fulfilled' ? (presCounts.value as { data: { user_id: string }[] | null }).data : null;
    const pptxData = pptxCounts.status === 'fulfilled' ? (pptxCounts.value as { data: { user_id: string }[] | null }).data : null;
    const pdfData = pdfCounts.status === 'fulfilled' ? (pdfCounts.value as { data: { user_id: string }[] | null }).data : null;

    const presMap = new Map<string, number>();
    for (const p of presData || []) presMap.set(p.user_id, (presMap.get(p.user_id) || 0) + 1);

    const pptxMap = new Map<string, number>();
    for (const p of pptxData || []) pptxMap.set(p.user_id, (pptxMap.get(p.user_id) || 0) + 1);

    const pdfMap = new Map<string, number>();
    for (const p of pdfData || []) pdfMap.set(p.user_id, (pdfMap.get(p.user_id) || 0) + 1);

    const rows: AdminUserRow[] = profiles.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      full_name: (p.full_name as string) || '',
      email: p.email as string | null,
      username: p.username as string | null,
      avatar_url: p.avatar_url as string | null,
      role: (p.role as string) || 'user',
      is_disabled: (p.is_disabled as boolean) || false,
      last_login: p.last_login as string | null,
      last_activity: p.last_activity as string | null,
      created_at: p.created_at as string,
      presentation_count: presMap.get(p.id as string) || 0,
      pptx_exports: pptxMap.get(p.id as string) || 0,
      pdf_exports: pdfMap.get(p.id as string) || 0,
    }));

    return { data: rows, total: count || 0, error: null };
  } catch (err) {
    return { data: null, total: 0, error: err instanceof Error ? err.message : 'Failed to load users' };
  }
}

export async function fetchAdminUserDetail(userId: string): Promise<{ data: AdminUserRow | null; error: string | null }> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!profile) return { data: null, error: 'User not found' };

    const [presCounts, pptxCounts, pdfCounts] = await Promise.allSettled([
      supabase.from('presentations').select('user_id').eq('user_id', userId),
      supabase.from('activity_logs').select('user_id').eq('action', 'pptx_export').eq('user_id', userId),
      supabase.from('activity_logs').select('user_id').eq('action', 'pdf_export').eq('user_id', userId),
    ]);

    const presData = presCounts.status === 'fulfilled' ? presCounts.value.data : null;
    const pptxData = pptxCounts.status === 'fulfilled' ? pptxCounts.value.data : null;
    const pdfData = pdfCounts.status === 'fulfilled' ? pdfCounts.value.data : null;

    const row: AdminUserRow = {
      id: profile.id,
      full_name: profile.full_name || '',
      email: profile.email,
      username: profile.username,
      avatar_url: profile.avatar_url,
      role: profile.role || 'user',
      is_disabled: profile.is_disabled || false,
      last_login: profile.last_login,
      last_activity: profile.last_activity,
      created_at: profile.created_at,
      presentation_count: presData?.length || 0,
      pptx_exports: pptxData?.length || 0,
      pdf_exports: pdfData?.length || 0,
    };

    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load user' };
  }
}

export async function fetchUserPresentations(userId: string): Promise<{ data: AdminPresentationRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('presentations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return {
      data: (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        user_id: p.user_id as string,
        title: p.title as string,
        theme: p.theme as string | null,
        total_slides: p.total_slides as number,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        user_email: null,
        user_name: '',
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load presentations' };
  }
}

export async function fetchUserActivity(userId: string): Promise<{ data: AdminActivityRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { data: null, error: error.message };
    return {
      data: (data || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        user_id: a.user_id as string | null,
        action: a.action as string,
        details: a.details as Record<string, unknown> | null,
        created_at: a.created_at as string,
        user_email: null,
        user_name: '',
      })),
      error: null,
    };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load activity' };
  }
}

export async function fetchAdminPresentations(
  page: number,
  perPage: number,
  search: string,
): Promise<{ data: AdminPresentationRow[] | null; total: number; error: string | null }> {
  try {
    let query = supabase.from('presentations').select('*, profiles!presentations_profile_user_id_fkey(full_name,email,username)', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false });

    const from = page * perPage;
    const to = from + perPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) return { data: null, total: 0, error: error.message };
    if (!data) return { data: [], total: count || 0, error: null };

    const rows: AdminPresentationRow[] = data.map((p: Record<string, unknown>) => {
      const profile = p.profiles as Record<string, unknown> | null;
      return {
        id: p.id as string,
        user_id: p.user_id as string,
        title: p.title as string,
        theme: p.theme as string | null,
        total_slides: p.total_slides as number,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        user_email: (profile?.email as string) || null,
        user_name: (profile?.full_name as string) || (profile?.username as string) || 'Unknown',
      };
    });

    return { data: rows, total: count || 0, error: null };
  } catch (err) {
    return { data: null, total: 0, error: err instanceof Error ? err.message : 'Failed to load presentations' };
  }
}

export async function fetchAdminActivity(limit = 20): Promise<{ data: AdminActivityRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, profiles!activity_logs_profile_user_id_fkey(full_name,email,username)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    if (!data) return { data: [], error: null };

    const rows: AdminActivityRow[] = data.map((a: Record<string, unknown>) => {
      const profile = a.profiles as Record<string, unknown> | null;
      return {
        id: a.id as string,
        user_id: a.user_id as string | null,
        action: a.action as string,
        details: a.details as Record<string, unknown> | null,
        created_at: a.created_at as string,
        user_email: (profile?.email as string) || null,
        user_name: (profile?.full_name as string) || (profile?.username as string) || 'Unknown',
      };
    });

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load activity' };
  }
}

export async function fetchAdminAuditLogs(limit = 20): Promise<{ data: AdminAuditLogRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*, admin:profiles!admin_audit_logs_admin_profile_fkey(full_name,email,username), target:profiles!admin_audit_logs_target_user_id_fkey(full_name,email,username)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error: error.message };
    if (!data) return { data: [], error: null };

    const rows: AdminAuditLogRow[] = data.map((a: Record<string, unknown>) => {
      const admin = a.admin as Record<string, unknown> | null;
      const target = a.target as Record<string, unknown> | null;
      return {
        id: a.id as string,
        admin_id: a.admin_id as string,
        action: a.action as string,
        target_user_id: a.target_user_id as string | null,
        details: a.details as Record<string, unknown> | null,
        created_at: a.created_at as string,
        admin_name: (admin?.full_name as string) || (admin?.email as string) || 'Unknown',
        target_name: (target?.full_name as string) || (target?.email as string) || null,
      };
    });

    return { data: rows, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed to load audit logs' };
  }
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_disabled: disabled })
    .eq('id', userId);
  if (error) return { error: error.message };

  await logAdminAction(disabled ? 'user_disabled' : 'user_enabled', userId);
  return { error: null };
}

export async function setUserRole(userId: string, role: 'user' | 'admin'): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) return { error: error.message };

  await logAdminAction('user_role_changed', userId, { new_role: role });
  return { error: null };
}

export async function deleteUserAccount(userId: string): Promise<{ error: string | null }> {
  // Delete user's presentations first
  const { error: presErr } = await supabase.from('presentations').delete().eq('user_id', userId);
  if (presErr) return { error: presErr.message };

  // Delete user's activity logs
  const { error: actErr } = await supabase.from('activity_logs').delete().eq('user_id', userId);
  if (actErr) return { error: actErr.message };

  // Delete the profile
  const { error: profErr } = await supabase.from('profiles').delete().eq('id', userId);
  if (profErr) return { error: profErr.message };

  await logAdminAction('user_deleted', userId);
  return { error: null };
}

// ── Feedback ───────────────────────────────────────────────────────────────────

export type FeedbackType = 'general' | 'problem' | 'bug' | 'feature_request' | 'other';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved';

export interface FeedbackRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  feedback_type: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function submitFeedback(
  feedbackType: FeedbackType,
  message: string,
  userName: string,
  userEmail: string,
): Promise<{ error: string | null }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return { error: 'You must be signed in to submit feedback.' };

    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: session.user.id,
        user_name: userName,
        user_email: userEmail,
        feedback_type: feedbackType,
        message,
        status: 'open',
      });
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to submit feedback' };
  }
}

export async function fetchFeedbackCount(): Promise<{ count: number; error: string | null }> {
  try {
    const { count, error } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);
    if (error) return { count: 0, error: error.message };
    return { count: count || 0, error: null };
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function fetchAllFeedback(
  page: number,
  perPage: number,
  statusFilter: 'all' | FeedbackStatus = 'all',
): Promise<{ data: FeedbackRow[] | null; total: number; error: string | null }> {
  try {
    let query = supabase.from('feedback').select('*', { count: 'exact' });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    query = query.order('created_at', { ascending: false });
    const from = page * perPage;
    query = query.range(from, from + perPage - 1);

    const { data, count, error } = await query;
    if (error) return { data: null, total: 0, error: error.message };
    return { data: (data || []) as FeedbackRow[], total: count || 0, error: null };
  } catch (err) {
    return { data: null, total: 0, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function fetchFeedbackDetail(id: string): Promise<{ data: FeedbackRow | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data as FeedbackRow | null, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('feedback')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function fetchOwnFeedback(): Promise<{ data: FeedbackRow[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as FeedbackRow[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function deleteFeedback(id: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('delete_feedback', { p_feedback_id: id });
    if (error) return { error: error.message };
    if (data && data.success === false) return { error: data.error || 'Failed to delete feedback' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete feedback' };
  }
}

// ── Feedback Messages (conversation) ─────────────────────────────────────────

export interface FeedbackMessage {
  id: string;
  feedback_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

export async function fetchFeedbackMessages(feedbackId: string): Promise<{ data: FeedbackMessage[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('feedback_messages')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: data as FeedbackMessage[], error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function addFeedbackMessage(feedbackId: string, message: string): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('add_feedback_message', {
      p_feedback_id: feedbackId,
      p_message: message,
    });
    if (error) return { error: error.message };
    if (data && data.success === false) return { error: data.error || 'Failed to send message' };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send message' };
  }
}

// ── Chart data ────────────────────────────────────────────────────────────────

export interface ChartPoint {
  date: string;
  count: number;
}

export async function fetchRegistrationsChart(days = 30): Promise<{ data: ChartPoint[] | null; error: string | null }> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };

    const buckets = new Map<string, number>();
    for (const p of data || []) {
      const day = (p.created_at as string).slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }

    const points: ChartPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      points.push({ date: day, count: buckets.get(day) || 0 });
    }

    return { data: points, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function fetchPresentationsChart(days = 30): Promise<{ data: ChartPoint[] | null; error: string | null }> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('presentations')
      .select('created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };

    const buckets = new Map<string, number>();
    for (const p of data || []) {
      const day = (p.created_at as string).slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }

    const points: ChartPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      points.push({ date: day, count: buckets.get(day) || 0 });
    }

    return { data: points, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}

export async function fetchVisitorsChart(days = 30): Promise<{ data: ChartPoint[] | null; error: string | null }> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('visitor_events')
      .select('created_at')
      .gte('created_at', startDate)
      .order('created_at', { ascending: true });
    if (error) return { data: null, error: error.message };

    const buckets = new Map<string, number>();
    for (const v of data || []) {
      const day = (v.created_at as string).slice(0, 10);
      buckets.set(day, (buckets.get(day) || 0) + 1);
    }

    const points: ChartPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      points.push({ date: day, count: buckets.get(day) || 0 });
    }

    return { data: points, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Failed' };
  }
}
