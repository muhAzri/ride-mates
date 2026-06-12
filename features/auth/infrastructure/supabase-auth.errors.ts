/**
 * Translates Supabase GoTrue auth errors into the contract's `ApiError` codes.
 * Isolated here so the repository stays readable and the mapping is the single
 * thing to revisit if GoTrue error codes change.
 */
import type { AuthError } from '@supabase/supabase-js';
import { ApiError } from '@/shared/http/api-error';

type AuthFlow = 'register' | 'login' | 'social' | 'refresh' | 'reset' | 'change';

function codeOf(error: AuthError): string {
  // `code` is the stable GoTrue error code; fall back to message matching.
  return (error.code ?? '').toLowerCase();
}

/** GoTrue throttle messages embed the wait, e.g. "…after 11 seconds." */
function parseRetryAfterSeconds(message: string): number | undefined {
  const match = message.match(/after (\d+)\s*second/i);
  return match ? Number(match[1]) : undefined;
}

export function mapAuthError(error: AuthError, flow: AuthFlow): ApiError {
  const code = codeOf(error);
  const message = error.message.toLowerCase();

  // Throttled by GoTrue (e.g. confirmation-email send limit, repeated requests)
  // → 429 RATE_LIMITED, with Retry-After parsed from the message when present.
  // The raw provider text is never forwarded — only a clean, user-safe message.
  if (
    error.status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('you can only request this after')
  ) {
    const retryAfter = parseRetryAfterSeconds(error.message);
    const wait = retryAfter ? ` Please try again in ${retryAfter} seconds.` : ' Please try again in a moment.';
    return ApiError.rateLimited(`Too many requests.${wait}`, retryAfter);
  }

  // Duplicate email on register → 409 CONFLICT (UA-1 acceptance).
  if (
    flow === 'register' &&
    (code === 'user_already_exists' ||
      code === 'email_exists' ||
      message.includes('already registered') ||
      message.includes('already been registered'))
  ) {
    return ApiError.conflict('Email is already registered.', {
      email: 'Email is already registered.',
    });
  }

  // New password must differ from the old one → 422 UNPROCESSABLE (UA-5).
  if (code === 'same_password' || message.includes('should be different')) {
    return ApiError.unprocessable('New password must be different from the current one.', {
      newPassword: 'Choose a password you have not used before.',
    });
  }

  // Server-side weak password → 422 UNPROCESSABLE (defensive; we also pre-check).
  if (code === 'weak_password' || message.includes('password should be')) {
    return ApiError.unprocessable('Password does not meet the minimum strength.', {
      password: 'Choose a stronger password.',
    });
  }

  // Invalid/expired recovery code on reset → 401 UNAUTHENTICATED (UA-5).
  if (flow === 'reset') {
    return ApiError.unauthenticated('Reset code is invalid or expired.');
  }

  // Bad credentials / unverified identity → 401 UNAUTHENTICATED (UA-2 acceptance).
  if (
    flow === 'login' &&
    (code === 'invalid_credentials' ||
      code === 'invalid_login_credentials' ||
      error.status === 400)
  ) {
    return ApiError.unauthenticated('Invalid email or password.');
  }

  if (flow === 'social') {
    return ApiError.unauthenticated('Google sign-in could not be verified.');
  }

  if (flow === 'refresh') {
    return ApiError.unauthenticated('Refresh token is invalid or expired.');
  }

  // Anything else: never forward the provider's raw text. Log it for ops, return
  // a clean message — 401 for 4xx auth failures, generic 500 otherwise.
  console.error(`[auth] unmapped auth error (flow=${flow})`, error);
  if (error.status && error.status >= 400 && error.status < 500) {
    return ApiError.unauthenticated('We could not verify your request. Please try again.');
  }
  return ApiError.internal();
}
