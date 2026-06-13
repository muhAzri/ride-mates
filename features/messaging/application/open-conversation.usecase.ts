/**
 * POST /conversations (MP-6, MS-1) — open or return the existing 1:1 conversation.
 * Idempotent per pair and the block rule (MD-5) are enforced in the DB function;
 * this use-case just delegates.
 */
import type { MessagingRepository } from '../domain/messaging.repository';
import type { Conversation, OpenConversationCommand } from '../domain/messaging.types';

export class OpenConversationUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(accessToken: string, command: OpenConversationCommand): Promise<Conversation> {
    return this.repo.openConversation(accessToken, command);
  }
}
