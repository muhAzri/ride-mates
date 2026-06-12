/**
 * Validated access to Supabase environment configuration. Centralised so a
 * missing/misconfigured secret fails loudly in one place instead of producing
 * obscure runtime errors deep in the data layer.
 *
 * Server-only secrets are read without the `NEXT_PUBLIC_` prefix; we fall back
 * to the public names for local convenience.
 */

export interface SupabaseConfig {
  url: string;
  /** Public API key — the new publishable key (`sb_publishable_…`) or legacy anon key. */
  key: string;
}

let cached: SupabaseConfig | null = null;

/**
 * Normalise to the bare project URL. supabase-js and our GoTrue calls append
 * their own paths (`/auth/v1/…`, `/rest/v1/…`), so a pasted REST endpoint or
 * trailing slash must be stripped or every request 404s.
 */
function normaliseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '') // trailing slashes
    .replace(/\/(rest|auth)\/v\d+$/, ''); // accidental REST/Auth path suffix
}

export function getSupabaseConfig(): SupabaseConfig {
  if (cached) return cached;

  const rawUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer the new publishable key; fall back to the legacy anon key.
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !key) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local',
    );
  }

  cached = { url: normaliseUrl(rawUrl), key };
  return cached;
}
