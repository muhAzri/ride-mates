/**
 * PUT/DELETE /threads/{id}/upvote (CF-3) — toggle a thread upvote. One vote per
 * user, idempotent; the repository returns the persisted `upvoteCount` and the
 * caller's new `isUpvotedByMe` state.
 */
import type { ForumRepository } from '../domain/forum.repository';
import type { UpvoteResult } from '../domain/forum.types';

export class UpvoteThreadUseCase {
  constructor(private readonly repo: ForumRepository) {}

  /** PUT — add my upvote. */
  add(accessToken: string, threadId: string): Promise<UpvoteResult> {
    return this.repo.setUpvote(accessToken, threadId, true);
  }

  /** DELETE — remove my upvote. */
  remove(accessToken: string, threadId: string): Promise<UpvoteResult> {
    return this.repo.setUpvote(accessToken, threadId, false);
  }
}
