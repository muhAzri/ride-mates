/**
 * Forum data port (Dependency Inversion). Application use-cases depend on this
 * interface; the Supabase adapter implements it. All reads/writes go through a
 * token-scoped client so RLS / `auth.uid()` run as the caller. Denormalized
 * counts and the NT-2 reply notification are maintained by DB triggers, so the
 * adapter never computes them.
 */
import type {
  Comment,
  CreateThreadCommand,
  Thread,
  ThreadQuery,
  UpvoteResult,
} from './forum.types';

/** Just enough of a thread to authorize a delete (owner/admin). */
export interface ThreadOwnership {
  authorId: string;
  isRemoved: boolean;
}

/** Just enough of a comment to authorize a delete (owner/admin). */
export interface CommentOwnership {
  authorId: string;
  isRemoved: boolean;
}

export interface SavedThreadsResult {
  items: Thread[];
  totalCount: number;
}

export interface ForumRepository {
  /** Resolve the caller's user id + admin flag (for ownership rules). */
  getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }>;

  /** List/search/filter threads (CF-1/4/5). Fetches `query.limit` rows. */
  listThreads(accessToken: string, query: ThreadQuery): Promise<Thread[]>;

  /** Create a thread (CF-1) and return it. */
  createThread(accessToken: string, command: CreateThreadCommand): Promise<Thread>;

  /** Read one thread (CF-2). `null` when missing or hidden from the caller. */
  getThread(accessToken: string, threadId: string): Promise<Thread | null>;

  /** Authorize a thread delete: author/removed state, or `null` if not visible. */
  getThreadOwnership(accessToken: string, threadId: string): Promise<ThreadOwnership | null>;

  /** Delete a thread the caller owns (CF-1). */
  deleteThread(accessToken: string, threadId: string): Promise<void>;

  /** Toggle the caller's upvote (CF-3). Returns the persisted count + my state. */
  setUpvote(accessToken: string, threadId: string, on: boolean): Promise<UpvoteResult>;

  /** Toggle the caller's bookmark (§9). */
  setBookmark(accessToken: string, threadId: string, on: boolean): Promise<void>;

  /** The caller's bookmarked threads + total count (§9, 14 Saved › Threads). */
  listBookmarkedThreads(
    accessToken: string,
    limit: number,
    offset: number,
  ): Promise<SavedThreadsResult>;

  /** List a thread's comments oldest-first (CF-2). Fetches `limit` rows. */
  listComments(
    accessToken: string,
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<Comment[]>;

  /** Add a comment (CF-2). The DB trigger fans out the NT-2 reply notification. */
  createComment(accessToken: string, threadId: string, body: string): Promise<Comment>;

  /** Authorize a comment delete, or `null` if not visible. */
  getCommentOwnership(accessToken: string, commentId: string): Promise<CommentOwnership | null>;

  /** Delete a comment the caller owns (CF-2). */
  deleteComment(accessToken: string, commentId: string): Promise<void>;
}
