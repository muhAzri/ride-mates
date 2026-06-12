/**
 * The auth data port (Dependency Inversion). Application use-cases depend on
 * this interface; the Supabase adapter implements it in the infrastructure
 * layer. Swapping identity providers means writing a new adapter, nothing else.
 *
 * Methods are deliberately granular (identity calls vs. snapshot read) so the
 * use-cases own the orchestration, keeping each piece single-responsibility.
 */
import type {
  AccountSnapshot,
  AuthTokens,
  ChangePasswordCommand,
  LoginCommand,
  RawSession,
  RegisterCommand,
  ResetPasswordCommand,
} from './auth.types';

export interface AuthRepository {
  /** Create an email/password account and return its first session (UA-1). */
  signUpWithPassword(command: RegisterCommand): Promise<RawSession>;

  /** Authenticate an email/password account (UA-2). */
  signInWithPassword(command: LoginCommand): Promise<RawSession>;

  /** Verify a Google ID token; create or link the account (UA-6). */
  signInWithGoogle(idToken: string): Promise<RawSession>;

  /** Exchange a refresh token for a rotated session (UA-2). */
  refreshSession(refreshToken: string): Promise<AuthTokens>;

  /** Revoke the session behind an access token (logout — UA-2). */
  revokeSession(accessToken: string): Promise<void>;

  /**
   * Send a password-recovery email if the account exists (UA-5). Implementations
   * must not reveal whether the email is registered (no account enumeration).
   */
  requestPasswordReset(email: string): Promise<void>;

  /** Consume a recovery token and set a new password (UA-5). */
  resetPassword(command: ResetPasswordCommand): Promise<void>;

  /** Change the caller's password after verifying the current one (UA-5). */
  changePassword(command: ChangePasswordCommand): Promise<void>;

  /** Read the caller's self projection + onboarding flags for a fresh session. */
  getAccountSnapshot(session: RawSession): Promise<AccountSnapshot>;
}
