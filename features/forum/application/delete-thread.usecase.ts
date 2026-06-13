/**
 * DELETE /threads/{id} (CF-1) — owner-only delete. `404` for missing/hidden,
 * `403` for someone else's thread; admins may delete (moderation).
 */
import { ApiError } from '@/shared/http/api-error';
import type { ForumRepository } from '../domain/forum.repository';

export class DeleteThreadUseCase {
  constructor(private readonly repo: ForumRepository) {}

  async execute(accessToken: string, threadId: string): Promise<void> {
    const viewer = await this.repo.getViewer(accessToken);
    const ownership = await this.repo.getThreadOwnership(accessToken, threadId);

    if (!ownership) {
      throw ApiError.notFound('Thread not found.');
    }
    if (ownership.authorId !== viewer.id && !viewer.isAdmin) {
      throw ApiError.forbidden('You can only delete your own threads.');
    }

    await this.repo.deleteThread(accessToken, threadId);
  }
}
