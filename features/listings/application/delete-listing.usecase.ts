/**
 * DELETE /listings/{id} (MP-3) — owner-only delete. Same authorization rules as
 * edit: `404` for missing/hidden, `403` for someone else's listing; admins may
 * delete (moderation). After this the listing disappears from browse/search.
 */
import { ApiError } from '@/shared/http/api-error';
import type { ListingsRepository } from '../domain/listings.repository';

export class DeleteListingUseCase {
  constructor(private readonly repo: ListingsRepository) {}

  async execute(accessToken: string, listingId: string): Promise<void> {
    const viewer = await this.repo.getViewer(accessToken);
    const ownership = await this.repo.getOwnership(accessToken, listingId);

    if (!ownership) {
      throw ApiError.notFound('Listing not found.');
    }
    if (ownership.ownerId !== viewer.id && !viewer.isAdmin) {
      throw ApiError.forbidden('You can only delete your own listings.');
    }

    await this.repo.remove(accessToken, listingId);
  }
}
