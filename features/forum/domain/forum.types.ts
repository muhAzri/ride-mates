/**
 * Community forum domain models (API_CONTRACT.md §8, §9, §17.3, §17.4; FSD §5.3
 * CF-1..5). Transport- and store-agnostic. `upvoteCount`/`commentCount` are
 * denormalized in the DB and kept correct by triggers; the per-viewer flags
 * (`isUpvotedByMe`/`isBookmarkedByMe`) are resolved per request.
 */

export type ThreadCategory = 'rides' | 'tech' | 'gear' | 'general';
export type ThreadSort = 'latest' | 'top';
export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

/** Public author mini-card on a thread/comment (§17.3/§17.4). */
export interface AuthorMini {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
}

/** A forum thread (§17.3). The list serialises `body` as a snippet; detail full. */
export interface Thread {
  id: string;
  author: AuthorMini;
  title: string;
  body: string;
  category: ThreadCategory | null;
  upvoteCount: number;
  commentCount: number;
  isUpvotedByMe: boolean;
  isBookmarkedByMe: boolean;
  createdAt: string;
}

/** A comment under a thread (§17.4). */
export interface Comment {
  id: string;
  threadId: string;
  author: AuthorMini;
  body: string;
  createdAt: string;
}

/** Query for `GET /threads` (CF-1/4/5). */
export interface ThreadQuery {
  q?: string;
  category?: ThreadCategory;
  sort: ThreadSort;
  limit: number;
  offset: number;
}

export interface CreateThreadCommand {
  title: string;
  body: string;
  category?: ThreadCategory;
}

/** Result of toggling a thread upvote (CF-3) — the persisted count + my state. */
export interface UpvoteResult {
  upvoteCount: number;
  isUpvotedByMe: boolean;
}
