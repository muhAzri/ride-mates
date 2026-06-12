/**
 * Users data port (Dependency Inversion). Application use-cases depend on this
 * interface; the Supabase adapter implements it. Methods take the caller's
 * access token so Postgres RLS runs as that user — coordinates are never read
 * here (they live in owner-only tables; LP-1).
 */
import type {
  AuthIdentity,
  PublicProfile,
  SelfProfile,
  UpdateProfileCommand,
} from './user.types';

export interface UsersRepository {
  /** Resolve the caller's identity (id + email) from their access token. */
  getIdentity(accessToken: string): Promise<AuthIdentity>;

  /** Read the caller's own full profile projection (§17.1 self). */
  getSelf(accessToken: string): Promise<SelfProfile>;

  /** Apply a partial profile update and return the refreshed self projection. */
  updateProfile(accessToken: string, command: UpdateProfileCommand): Promise<SelfProfile>;

  /** Read another user's public projection (§17.1 public). 404 if missing. */
  getPublicProfile(accessToken: string, userId: string): Promise<PublicProfile>;

  /** Persist (or clear, with `null`) the caller's avatar URL on their profile. */
  setAvatarUrl(accessToken: string, avatarUrl: string | null): Promise<void>;
}
