/**
 * GET /conversations/{id}/messages (MS-2) — a conversation's messages, newest
 * first, cursor-paginated. Participation is checked up front so a non-participant
 * gets `403 FORBIDDEN` (MS-1) rather than a silently-empty page.
 */
import { ApiError } from '@/shared/http/api-error';
import { buildPage, type Page } from '@/shared/http/pagination';
import type { MessagingRepository } from '../domain/messaging.repository';
import type { Message } from '../domain/messaging.types';

export class ListMessagesUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(
    accessToken: string,
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Page<Message>> {
    const isParticipant = await this.repo.isParticipant(accessToken, conversationId);
    if (!isParticipant) {
      throw ApiError.forbidden('You are not a participant in this conversation.');
    }
    const rows = await this.repo.listMessages(accessToken, conversationId, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }
}
