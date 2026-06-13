/**
 * GET /threads/{id} (CF-2) — thread detail. A missing or moderation-hidden thread
 * is `404` (a removed thread is hidden from non-owners by RLS).
 */
import { ApiError } from '@/shared/http/api-error';
import type { ForumRepository } from '../domain/forum.repository';
import type { Thread } from '../domain/forum.types';

export class GetThreadUseCase {
  constructor(private readonly repo: ForumRepository) {}

  async execute(accessToken: string, threadId: string): Promise<Thread> {
    const thread = await this.repo.getThread(accessToken, threadId);
    if (!thread) {
      throw ApiError.notFound('Thread not found.');
    }
    return thread;
  }
}
