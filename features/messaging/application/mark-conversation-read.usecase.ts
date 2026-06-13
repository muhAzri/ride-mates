/**
 * POST /conversations/{id}/read (MS-4) — advance the caller's read marker so the
 * unread indicators clear. The DB function rejects non-participants (`403`).
 */
import type { MessagingRepository } from '../domain/messaging.repository';

export class MarkConversationReadUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(accessToken: string, conversationId: string): Promise<void> {
    await this.repo.markRead(accessToken, conversationId);
  }
}
