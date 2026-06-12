/**
 * Auth domain models. These are framework- and transport-agnostic: no Supabase,
 * no HTTP. They mirror the contract's User (self) projection and token shape
 * (API_CONTRACT.md §17.1, §3) but exist independently so the rest of the feature
 * depends on this, not on the data store.
 */

export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';
export type ContactPreference = 'in_app_chat';
export type UserRole = 'user' | 'admin';

/** User (self) — the authenticated user's own, fuller projection (§17.1). */
export interface SelfUser {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  cyclingType: CyclingType | null;
  avatarUrl: string | null;
  contactPreference: ContactPreference;
  displayArea: string | null;
  areaLevel: string | null;
  ratingAverage: number | null;
  listingCount: number;
  threadCount: number;
  role: UserRole;
  createdAt: string;
}

/** Bearer token set returned to clients (§1.2, §3). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Onboarding routing flags (§3 register/social). Drive 03 Profile setup →
 * 04 Set location for fresh accounts.
 */
export interface OnboardingFlags {
  needsProfileSetup: boolean;
  needsLocation: boolean;
}

/** Low-level result of an identity-provider call: who, plus their tokens. */
export interface RawSession {
  userId: string;
  tokens: AuthTokens;
}

/** A user's account snapshot: self projection + computed onboarding flags. */
export interface AccountSnapshot {
  user: SelfUser;
  onboarding: OnboardingFlags;
}

/** Full successful authentication outcome returned by the use-cases. */
export interface AuthResult extends AccountSnapshot {
  tokens: AuthTokens;
}

export interface RegisterCommand {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface ResetPasswordCommand {
  /** Email the recovery code was sent to — required to verify the OTP (UA-5). */
  email: string;
  /** 6-digit recovery OTP delivered to the user by email (UA-5). */
  token: string;
  newPassword: string;
}

export interface ChangePasswordCommand {
  /** Caller's bearer access token (the endpoint is auth-required). */
  accessToken: string;
  currentPassword: string;
  newPassword: string;
}
