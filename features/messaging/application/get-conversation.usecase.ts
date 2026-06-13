/**
 * GET /conversations/{id} (MS-1) — one conversation, participant-only. A caller
 * who is not a participant cannot see it (RLS hides the row), which surfaces as
 * `403 FORBIDDEN` per the contract's participant gating.
 */
import { ApiError } from '@/shared/http/api-error';
import type { MessagingRepository } from '../domain/messaging.repository';
import type { Conversation } from '../domain/messaging.types';

export class GetConversationUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(accessToken: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.repo.getConversation(accessToken, conversationId);
    if (!conversation) {
      throw ApiError.forbidden('You are not a participant in this conversation.');
    }
    return conversation;
  }
}
