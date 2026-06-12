/**
 * GET /listings (MP-4/5/10/11) — browse / search / filter with proximity. Owns
 * cursor pagination: it fetches one extra row (`limit + 1`) so `buildPage` can
 * tell whether a next page exists. Ranking, distance, and the privacy invariant
 * are all enforced server-side in the `nearby_listings` RPC (LP-1..3).
 */
import { buildPage, type Page } from '@/shared/http/pagination';
import type { ListingsRepository } from '../domain/listings.repository';
import type { BrowseQuery, ListingCard } from '../domain/listing.types';

export class BrowseListingsUseCase {
  constructor(private readonly repo: ListingsRepository) {}

  async execute(accessToken: string, query: BrowseQuery): Promise<Page<ListingCard>> {
    const pageSize = query.limit;
    const rows = await this.repo.browse(accessToken, { ...query, limit: pageSize + 1 });
    return buildPage(rows, pageSize, query.offset);
  }
}
