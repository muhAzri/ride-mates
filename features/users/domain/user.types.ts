/**
 * Users & profile domain models (API_CONTRACT.md §4, §17.1). Framework- and
 * transport-agnostic: no Supabase, no HTTP, no S3. The contract exposes two
 * projections of a user — `SelfProfile` (own, fuller) and `PublicProfile`
 * (everyone else; no email/role/contactPreference, never coordinates: LP-1).
 */

export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';
export type ContactPreference = 'in_app_chat';
export type UserRole = 'user' | 'admin';

/** User (self) — returned by `GET /users/me` (§17.1). */
export interface SelfProfile {
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

/** User (public) — `SelfProfile` minus `email`, `role`, `contactPreference`. */
export interface PublicProfile {
  id: string;
  displayName: string;
  bio: string | null;
  cyclingType: CyclingType | null;
  avatarUrl: string | null;
  displayArea: string | null;
  areaLevel: string | null;
  ratingAverage: number | null;
  listingCount: number;
  threadCount: number;
  createdAt: string;
}

/**
 * Editable profile fields (PATCH /users/me — UA-3). All optional: a partial
 * update. `contactPreference` lives in `user_settings`; the rest in `profiles`.
 */
export interface UpdateProfileCommand {
  displayName?: string;
  bio?: string | null;
  cyclingType?: CyclingType;
  contactPreference?: ContactPreference;
}

/** Identity behind a bearer token (resolved from the access token). */
export interface AuthIdentity {
  id: string;
  email: string;
}
