/**
 * Thread comments (CF-2): list, add, delete. Adding a comment triggers the NT-2
 * reply notification (DB trigger). Authorization for delete is owner/admin; a
 * comment on a missing/hidden thread is `404`.
 */
import { ApiError } from '@/shared/http/api-error';
import { buildPage, type Page } from '@/shared/http/pagination';
import type { ForumRepository } from '../domain/forum.repository';
import type { Comment } from '../domain/forum.types';

export class CommentsUseCase {
  constructor(private readonly repo: ForumRepository) {}

  /** GET /threads/{id}/comments — oldest-first, paginated. */
  async list(
    accessToken: string,
    threadId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Comment>> {
    const rows = await this.repo.listComments(accessToken, threadId, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }

  /** POST /threads/{id}/comments — add a comment to a visible thread. */
  async create(accessToken: string, threadId: string, body: string): Promise<Comment> {
    const thread = await this.repo.getThreadOwnership(accessToken, threadId);
    if (!thread) {
      throw ApiError.notFound('Thread not found.');
    }
    return this.repo.createComment(accessToken, threadId, body);
  }

  /** DELETE /comments/{id} — owner-only (admins too). */
  async delete(accessToken: string, commentId: string): Promise<void> {
    const viewer = await this.repo.getViewer(accessToken);
    const ownership = await this.repo.getCommentOwnership(accessToken, commentId);

    if (!ownership) {
      throw ApiError.notFound('Comment not found.');
    }
    if (ownership.authorId !== viewer.id && !viewer.isAdmin) {
      throw ApiError.forbidden('You can only delete your own comments.');
    }

    await this.repo.deleteComment(accessToken, commentId);
  }
}
