/**
 * GET /threads (CF-1/4/5) — list / search / filter discussions. Owns cursor
 * pagination: fetches one extra row (`limit + 1`) so `buildPage` can tell whether
 * a next page exists. Sorting/filtering happen in the repository.
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { ForumRepository } from '../domain/forum.repository';
import type { Thread, ThreadQuery } from '../domain/forum.types';

export class ListThreadsUseCase {
  constructor(private readonly repo: ForumRepository) {}

  async execute(accessToken: string, query: ThreadQuery): Promise<Page<Thread>> {
    const pageSize = query.limit;
    const rows = await this.repo.listThreads(accessToken, { ...query, limit: pageSize + 1 });
    return buildPage(rows, pageSize, query.offset);
  }
}
