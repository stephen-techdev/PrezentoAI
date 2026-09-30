import { supabase } from './supabase';

export interface LoginAttemptStatus {
  locked: boolean;
  remaining_attempts: number;
  locked_until: string | null;
}

export async function checkLoginAttempt(email: string): Promise<LoginAttemptStatus> {
  const { data, error } = await supabase.rpc('check_login_attempt', { p_email: email });
  if (error || !data) {
    return { locked: false, remaining_attempts: 5, locked_until: null };
  }
  return data as LoginAttemptStatus;
}

export async function recordFailedLogin(email: string): Promise<LoginAttemptStatus> {
  const { data, error } = await supabase.rpc('record_failed_login', { p_email: email });
  if (error || !data) {
    return { locked: false, remaining_attempts: 4, locked_until: null };
  }
  return data as LoginAttemptStatus;
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await supabase.rpc('reset_login_attempts', { p_email: email });
}

export function formatLockoutTime(lockedUntil: string): string {
  const diff = new Date(lockedUntil).getTime() - Date.now();
  if (diff <= 0) return '0:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
