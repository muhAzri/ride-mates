/**
 * Bridges Supabase PostgREST errors to the contract's `ApiError` codes. The most
 * important case: a token-scoped query made with an expired/invalid JWT fails at
 * the database with `PGRST301/302/303` ("JWT expired"), which must surface as
 * `401 UNAUTHENTICATED`, not a generic `500` (API_CONTRACT.md §1.7).
 *
 * Use it at the start of a repository's error branch: it throws `401` for auth
 * failures and returns otherwise, leaving the caller to map domain-specific
 * errors (e.g. "could not save").
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { ApiError } from '@/shared/http/api-error';

/** PostgREST JWT-related error codes (verification failed / disabled / expired). */
const JWT_ERROR_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303']);

/** Throw `401 UNAUTHENTICATED` when a PostgREST error is a JWT/auth failure. */
export function rethrowIfAuthError(error: PostgrestError | null): void {
  if (!error) return;
  const isJwtError = JWT_ERROR_CODES.has(error.code ?? '') || /jwt/i.test(error.message ?? '');
  if (isJwtError) {
    throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
  }
}
