/**
 * Thread bookmarks (§9, design R3) — the Bookmark on 10 and the 14 Saved ›
 * Threads hub. Save/unsave are idempotent and flip `isBookmarkedByMe`; the list
 * returns threads + a total count for the "Threads · N" header. Pagination is
 * driven by that count (the repo reports it), not a fetched extra row.
 */
import { encodeCursor, type Page } from '@/shared/http/pagination';
import type { ForumRepository } from '../domain/forum.repository';
import type { Thread } from '../domain/forum.types';

export interface SavedThreadsPage {
  page: Page<Thread>;
  count: number;
}

export class BookmarkThreadsUseCase {
  constructor(private readonly repo: ForumRepository) {}

  /** PUT /threads/{id}/bookmark — idempotent save. */
  async bookmark(accessToken: string, threadId: string): Promise<{ isBookmarkedByMe: boolean }> {
    await this.repo.setBookmark(accessToken, threadId, true);
    return { isBookmarkedByMe: true };
  }

  /** DELETE /threads/{id}/bookmark — idempotent unsave. */
  async unbookmark(accessToken: string, threadId: string): Promise<{ isBookmarkedByMe: boolean }> {
    await this.repo.setBookmark(accessToken, threadId, false);
    return { isBookmarkedByMe: false };
  }

  /** GET /me/saved/threads — paginated bookmarks + total count. */
  async list(accessToken: string, limit: number, offset: number): Promise<SavedThreadsPage> {
    const { items, totalCount } = await this.repo.listBookmarkedThreads(accessToken, limit, offset);
    const hasMore = offset + items.length < totalCount;
    return {
      page: {
        data: items,
        page: {
          hasMore,
          nextCursor: hasMore ? encodeCursor(offset + limit) : null,
        },
      },
      count: totalCount,
    };
  }
}
