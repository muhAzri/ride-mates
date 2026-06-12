/**
 * Saved / Wishlist (§7, design R2) — the Heart on 06/07 and the 14 Saved hub.
 * Purely a personal saved list: no money or transaction semantics. Save/unsave
 * are idempotent and flip `isSavedByMe`; the list returns ListingCards + a total
 * count for the "Listings · N" header. Pagination is driven by that total count
 * (the feed RPC already reports it), not a fetched extra row.
 */
import { encodeCursor, type Page } from '@/shared/http/pagination';
import type { ListingsRepository } from '../domain/listings.repository';
import type { ListingCard } from '../domain/listing.types';

export interface SavedListingsPage {
  page: Page<ListingCard>;
  count: number;
}

export class SavedListingsUseCase {
  constructor(private readonly repo: ListingsRepository) {}

  /** PUT /listings/{id}/save — idempotent save. Returns the resulting flag. */
  async save(accessToken: string, listingId: string): Promise<{ isSavedByMe: boolean }> {
    await this.repo.save(accessToken, listingId);
    return { isSavedByMe: true };
  }

  /** DELETE /listings/{id}/save — idempotent unsave. */
  async unsave(accessToken: string, listingId: string): Promise<{ isSavedByMe: boolean }> {
    await this.repo.unsave(accessToken, listingId);
    return { isSavedByMe: false };
  }

  /** GET /me/saved/listings — paginated wishlist + total count. */
  async list(accessToken: string, limit: number, offset: number): Promise<SavedListingsPage> {
    const { items, totalCount } = await this.repo.listSaved(accessToken, limit, offset);
    const hasMore = offset + items.length < totalCount;
    return {
      page: {
        data: items,
        page: {
          hasMore,
          nextCursor: hasMore ? encodeCursor(offset + limit) : null,
        },
      },
      count: totalCount,
    };
  }
}
