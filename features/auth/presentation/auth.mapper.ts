/**
 * Maps domain results to the exact JSON wire shapes in API_CONTRACT.md §3.
 * Keeping serialisation here means the domain never has to know the HTTP shape
 * (e.g. that `needsProfileSetup`/`needsLocation` sit beside `user`/`tokens`).
 */
import type { AuthResult, AuthTokens, SelfUser } from '../domain/auth.types';

function toTokensDto(tokens: AuthTokens) {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  };
}

function toSelfUserDto(user: SelfUser) {
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

/** Register/login/social envelope (§3). */
export function toAuthResponse(result: AuthResult) {
  return {
    user: toSelfUserDto(result.user),
    tokens: toTokensDto(result.tokens),
    needsProfileSetup: result.onboarding.needsProfileSetup,
    needsLocation: result.onboarding.needsLocation,
  };
}

/** Refresh envelope (§3 refresh — rotated tokens). */
export function toTokensResponse(tokens: AuthTokens) {
  return { tokens: toTokensDto(tokens) };
}
