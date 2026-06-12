/**
 * GET /listings/{id} (MP-4/7/12) — full listing detail. The repository resolves
 * visibility (active/sold → anyone; inactive → owner/admin) and signals a
 * moderation-removed listing so this maps it to `410 GONE`, a missing/hidden one
 * to `404 NOT_FOUND` (API_CONTRACT.md §1.7).
 */
import { ApiError } from '@/shared/http/api-error';
import type { ListingsRepository } from '../domain/listings.repository';
import type { Listing } from '../domain/listing.types';

export class GetListingUseCase {
  constructor(private readonly repo: ListingsRepository) {}

  async execute(accessToken: string, listingId: string): Promise<Listing> {
    const { listing, removed } = await this.repo.getDetail(accessToken, listingId);
    if (removed) {
      throw new ApiError('GONE', 'This listing has been removed.');
    }
    if (!listing) {
      throw ApiError.notFound('Listing not found.');
    }
    return listing;
  }
}
