/**
 * Blocking (MD-5): list, block, unblock. After blocking, the messaging layer
 * refuses contact between the pair (enforced where conversations/messages live).
 * Block/unblock are idempotent and flip the relationship.
 */
import type { ModerationRepository } from '../domain/moderation.repository';
import type { BlockedUser } from '../domain/moderation.types';

export class BlocksUseCase {
  constructor(private readonly repo: ModerationRepository) {}

  /** GET /me/blocks — the caller's block list + count. */
  async list(accessToken: string): Promise<{ items: BlockedUser[]; count: number }> {
    const items = await this.repo.listBlocks(accessToken);
    return { items, count: items.length };
  }

  /** PUT /users/{userId}/block. */
  async block(accessToken: string, userId: string): Promise<{ blocked: boolean }> {
    await this.repo.block(accessToken, userId);
    return { blocked: true };
  }

  /** DELETE /users/{userId}/block. */
  async unblock(accessToken: string, userId: string): Promise<{ blocked: boolean }> {
    await this.repo.unblock(accessToken, userId);
    return { blocked: false };
  }
}
