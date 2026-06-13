/**
 * Maps feedback domain models to the wire shapes (API_CONTRACT.md §13, §12.5).
 */
import type { ChangelogEntry, FeatureRequest, FeedbackReceipt, VoteResult } from '../domain/feedback.types';

/** POST /feedback → `{ id, status: "received" }`. */
export function toFeedbackReceiptDto(receipt: FeedbackReceipt) {
  return { id: receipt.id, status: receipt.status };
}

/** Feature-request board item. */
export function toFeatureRequestDto(request: FeatureRequest) {
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    voteCount: request.voteCount,
    status: request.status,
    isVotedByMe: request.isVotedByMe,
    createdAt: request.createdAt,
  };
}

/** PUT/DELETE vote → `{ voteCount, isVotedByMe }`. */
export function toVoteResultDto(result: VoteResult) {
  return { voteCount: result.voteCount, isVotedByMe: result.isVotedByMe };
}

/** Changelog entry — "What's new". */
export function toChangelogEntryDto(entry: ChangelogEntry) {
  return { version: entry.version, date: entry.date, title: entry.title, items: entry.items };
}
