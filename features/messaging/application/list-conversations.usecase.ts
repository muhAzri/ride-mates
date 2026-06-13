/**
 * GET /conversations (MS-4) — the caller's conversation list with unread counts.
 * Owns cursor pagination: fetches one extra row (`limit + 1`) so `buildPage` can
 * tell whether a next page exists.
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { MessagingRepository } from '../domain/messaging.repository';
import type { Conversation } from '../domain/messaging.types';

export class ListConversationsUseCase {
  constructor(private readonly repo: MessagingRepository) {}

  async execute(accessToken: string, limit: number, offset: number): Promise<Page<Conversation>> {
    const rows = await this.repo.listConversations(accessToken, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }
}
