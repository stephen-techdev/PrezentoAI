import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function createNoopClient(): SupabaseClient {
  const noop = new Proxy(() => noop, {
    get: () => noop,
    apply: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
  });
  return noop as unknown as SupabaseClient;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: { 'X-Client-Info': 'prezento-ai' },
      },
    })
  : createNoopClient();
