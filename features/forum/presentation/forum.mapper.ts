/**
 * Maps forum domain models to the exact JSON wire shapes (API_CONTRACT.md §8,
 * §17.3, §17.4). The list serialises `body` as a snippet (09 shows a preview);
 * detail returns the full body. Relative timestamps are client-formatted.
 */
import type { AuthorMini, Comment, Thread } from '../domain/forum.types';

/** Max characters of `body` shown on a thread list card (the 09 preview). */
const SNIPPET_LENGTH = 280;

function toAuthorDto(author: AuthorMini) {
  return {
    id: author.id,
    displayName: author.displayName,
    avatarUrl: author.avatarUrl,
    cyclingType: author.cyclingType,
    ratingAverage: author.ratingAverage,
  };
}

function snippet(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > SNIPPET_LENGTH ? `${trimmed.slice(0, SNIPPET_LENGTH)}…` : trimmed;
}

function toThreadBase(thread: Thread, body: string) {
  return {
    id: thread.id,
    author: toAuthorDto(thread.author),
    title: thread.title,
    body,
    category: thread.category,
    upvoteCount: thread.upvoteCount,
    commentCount: thread.commentCount,
    isUpvotedByMe: thread.isUpvotedByMe,
    isBookmarkedByMe: thread.isBookmarkedByMe,
    createdAt: thread.createdAt,
  };
}

/** Thread list card — `body` snippet only (09, 14). */
export function toThreadListDto(thread: Thread) {
  return toThreadBase(thread, snippet(thread.body));
}

/** Thread detail — full `body` (10). */
export function toThreadDto(thread: Thread) {
  return toThreadBase(thread, thread.body);
}

/** Comment (§17.4). */
export function toCommentDto(comment: Comment) {
  return {
    id: comment.id,
    threadId: comment.threadId,
    author: toAuthorDto(comment.author),
    body: comment.body,
    createdAt: comment.createdAt,
  };
}
