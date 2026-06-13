/**
 * Maps domain profiles to the exact JSON wire shapes in API_CONTRACT.md §17.1.
 * Self vs. public projections are serialised here so the domain never has to
 * know which fields are caller-visible (email/role/contactPreference are
 * self-only; coordinates appear in neither — LP-1).
 */
import type {
  NotificationPreferences,
  PublicProfile,
  SelfProfile,
} from '../domain/user.types';

/** User (self) — `GET /users/me`, `PATCH /users/me`. */
export function toSelfUserDto(user: SelfProfile) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    cyclingType: user.cyclingType,
    avatarUrl: user.avatarUrl,
    contactPreference: user.contactPreference,
    displayArea: user.displayArea,
    areaLevel: user.areaLevel,
    ratingAverage: user.ratingAverage,
    listingCount: user.listingCount,
    threadCount: user.threadCount,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/** Notification toggles — `GET/PATCH /me/notification-preferences` (§14). */
export function toNotificationPreferencesDto(prefs: NotificationPreferences) {
  return { newMessages: prefs.newMessages, threadReplies: prefs.threadReplies };
}

/** User (public) — `GET /users/{userId}`. No email/role/contactPreference. */
export function toPublicUserDto(user: PublicProfile) {
  return {
    id: user.id,
    displayName: user.displayName,
    bio: user.bio,
    cyclingType: user.cyclingType,
    avatarUrl: user.avatarUrl,
    displayArea: user.displayArea,
    areaLevel: user.areaLevel,
    ratingAverage: user.ratingAverage,
    listingCount: user.listingCount,
    threadCount: user.threadCount,
    createdAt: user.createdAt,
  };
}
