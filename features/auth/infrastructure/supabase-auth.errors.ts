/**
 * Translates Supabase GoTrue auth errors into the contract's `ApiError` codes.
 * Isolated here so the repository stays readable and the mapping is the single
 * thing to revisit if GoTrue error codes change.
 */
import type { AuthError } from '@supabase/supabase-js';
import { ApiError } from '@/shared/http/api-error';

type AuthFlow = 'register' | 'login' | 'social' | 'refresh';

function codeOf(error: AuthError): string {
  // `code` is the stable GoTrue error code; fall back to message matching.
  return (error.code ?? '').toLowerCase();
}

export function mapAuthError(error: AuthError, flow: AuthFlow): ApiError {
  const code = codeOf(error);
  const message = error.message.toLowerCase();

  // Throttled by GoTrue (e.g. confirmation-email send limit) → 429 RATE_LIMITED.
  if (
    error.status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    message.includes('rate limit')
  ) {
    return ApiError.rateLimited(error.message);
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

  // Server-side weak password → 422 UNPROCESSABLE (defensive; we also pre-check).
  if (code === 'weak_password' || message.includes('password should be')) {
    return ApiError.unprocessable('Password does not meet the minimum strength.', {
      password: 'Choose a stronger password.',
    });
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

  // Anything else: surface 401 for 4xx auth failures, else a generic 500.
  if (error.status && error.status >= 400 && error.status < 500) {
    return ApiError.unauthenticated(error.message);
  }
  return ApiError.internal('Authentication provider error.');
}
