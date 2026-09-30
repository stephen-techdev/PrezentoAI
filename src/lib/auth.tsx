import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  username: string | null;
  gender: string | null;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  is_disabled: boolean;
  last_login: string | null;
  last_activity: string | null;
  created_at: string;
  updated_at: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, username: string, gender: string, avatarUrl: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchingProfileRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    // Prevent duplicate concurrent fetches for the same user
    if (fetchingProfileRef.current === userId) return;
    fetchingProfileRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error.message);
        return;
      }
      if (data) {
        setProfile(data as Profile);
      } else {
        // The handle_new_user trigger should have created the profile.
        // If we can't see it (e.g. no session yet), retry once after a delay.
        await new Promise((r) => setTimeout(r, 500));
        const { data: retryData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (retryData) {
          setProfile(retryData as Profile);
        } else {
          // Last resort: try to insert (only works if we have a valid session)
          const { data: newProfile, error: insertErr } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: email || '',
              full_name: '',
            })
            .select('*')
            .maybeSingle();
          if (insertErr) {
            console.error('Error creating profile:', insertErr.message);
            return;
          }
          if (newProfile) setProfile(newProfile as Profile);
        }
      }
    } finally {
      fetchingProfileRef.current = null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id, session.user.email || '');
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // getSession must always resolve loading, even on failure
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user?.id) {
          fetchProfile(data.session.user.id, data.session.user.email || '').finally(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to get session:', err);
        if (mounted) setLoading(false);
      });

    // Safety timeout: never stay on loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timed out — proceeding without session');
        setLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user?.id) {
        fetchProfile(newSession.user.id, newSession.user.email || '');
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    username: string,
    gender: string,
    avatarUrl: string,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
          gender,
          avatar_url: avatarUrl,
        },
      },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, email);
    }
    return { error: null };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Check if the account is disabled
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_disabled')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profile?.is_disabled) {
        await supabase.auth.signOut();
        return { error: 'This account has been disabled. Please contact an administrator.' };
      }

      // Update last_login
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', session.user.id)
        .then(() => {});

      // Log the login activity
      supabase
        .from('activity_logs')
        .insert({ user_id: session.user.id, action: 'login' })
        .then(() => {});
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
