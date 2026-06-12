/**
 * Supabase client factory for server-side (Route Handler) use. Two flavours:
 *
 *  - `createPublicClient`  — anon key, no session. Used for the unauthenticated
 *    auth flows (register, login, social, refresh).
 *  - `createScopedClient`  — carries a user's access token so Postgres RLS runs
 *    as that user (`auth.uid()` resolves). Used to read the caller's own data.
 *
 * Sessions are never persisted: this is a stateless, bearer-token API consumed
 * by web and mobile clients (API_CONTRACT.md §1.2).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../config/env';

const STATELESS_AUTH = { persistSession: false, autoRefreshToken: false } as const;

export function createPublicClient(): SupabaseClient {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, { auth: STATELESS_AUTH });
}

export function createScopedClient(accessToken: string): SupabaseClient {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: STATELESS_AUTH,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
