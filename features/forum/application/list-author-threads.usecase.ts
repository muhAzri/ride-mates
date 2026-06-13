/**
 * GET /users/{userId}/threads (CF-1, 13 Profile › Threads) — a specific author's
 * threads, cursor-paginated. Removed threads are excluded by the repository.
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { ForumRepository } from '../domain/forum.repository';
import type { Thread } from '../domain/forum.types';

export class ListAuthorThreadsUseCase {
  constructor(private readonly repo: ForumRepository) {}

  async execute(
    accessToken: string,
    authorId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Thread>> {
    const rows = await this.repo.listByAuthor(accessToken, authorId, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }
}
