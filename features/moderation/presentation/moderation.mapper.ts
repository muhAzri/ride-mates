/**
 * Maps moderation domain models to the wire shapes (API_CONTRACT.md §12, §17.8).
 */
import type { BlockedUser, ReportReceipt } from '../domain/moderation.types';

/** POST /reports response — `{ id, status: "queued" }`. */
export function toReportReceiptDto(receipt: ReportReceipt) {
  return { id: receipt.id, status: receipt.status };
}

/** GET /me/blocks item — public mini + when it was blocked. */
export function toBlockedUserDto(user: BlockedUser) {
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    cyclingType: user.cyclingType,
    ratingAverage: user.ratingAverage,
    blockedAt: user.blockedAt,
  };
}
