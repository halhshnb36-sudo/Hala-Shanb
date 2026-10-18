import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);
export const publishableKey = PUBLISHABLE_KEY ?? '';

/**
 * Browser client. It only ever uses the PUBLIC publishable (anon) key.
 * All protection comes from Row Level Security in the database — never from hiding buttons.
 */
export const supabase = createClient(SUPABASE_URL ?? 'http://localhost:54321', PUBLISHABLE_KEY ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

/** Turns a Supabase `{data, error}` result into a value, or throws an Error. */
export async function unwrap<T>(
  p: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
