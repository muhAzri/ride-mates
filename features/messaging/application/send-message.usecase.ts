/**
 * POST /conversations/{id}/messages (MS-2, MS-3) — send text and/or a shared
 * listing. Participation and the block rule (MD-5) are enforced by RLS on insert,
 * so the adapter maps those failures to `403`; this use-case just delegates. The
 * message must not be silently lost (NFR Reliability) — the persisted row is
 * returned so clients can reconcile optimistic sends by `id`.
 */
import type { MessagingRepository } from '../domain/messaging.repository';
import type { Message, SendMessageCommand } from '../domain/messaging.types';

export class SendMessageUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(
    accessToken: string,
    conversationId: string,
    command: SendMessageCommand,
  ): Promise<Message> {
    return this.repo.sendMessage(accessToken, conversationId, command);
  }
}
