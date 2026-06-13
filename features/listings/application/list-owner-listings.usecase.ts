/**
 * GET /users/{userId}/listings (MP-4, 13 Profile › Listings) — a specific
 * seller's listings, cursor-paginated. Visibility is RLS-scoped in the repository
 * (others see active only; the owner sees all their statuses).
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { ListingsRepository } from '../domain/listings.repository';
import type { ListingCard } from '../domain/listing.types';

export class ListOwnerListingsUseCase {
  constructor(private readonly repo: ListingsRepository) {}

  async execute(
    accessToken: string,
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<Page<ListingCard>> {
    const rows = await this.repo.listByOwner(accessToken, ownerId, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }
}
