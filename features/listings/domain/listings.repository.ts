/**
 * Listings data port (Dependency Inversion). Application use-cases depend on this
 * interface; the Supabase adapter implements it. Methods take the caller's access
 * token so RLS / `auth.uid()` resolve as that user. Distance is server-computed
 * and coordinates are never returned (LP-1..3). Photo *bytes* are handled by the
 * use-cases (object storage); this port only persists photo URLs.
 */
import type {
  BrowseQuery,
  CreateListingCommand,
  CurrentPhoto,
  Listing,
  ListingCard,
  ListingPhotoInput,
  UpdateListingFields,
} from './listing.types';

/** A listing as seen for an authorization decision (PATCH/DELETE owner checks). */
export interface ListingOwnership {
  ownerId: string;
  status: string;
  isRemoved: boolean;
}

export interface SavedListingsResult {
  items: ListingCard[];
  totalCount: number;
}

export interface ListingsRepository {
  /** Resolve the caller's user id + admin flag (for visibility/ownership rules). */
  getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }>;

  /** Browse/search/filter with proximity (MP-4/5/10/11). Fetches `limit` rows. */
  browse(accessToken: string, query: BrowseQuery): Promise<ListingCard[]>;

  /**
   * A specific owner's listings for their profile tab (13). RLS scopes visibility
   * (others see active only; the owner sees all their statuses). Distance is not
   * computed here, so `distanceKm` is null. Fetches `limit` rows.
   */
  listByOwner(
    accessToken: string,
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<ListingCard[]>;

  /** Create a listing + its (already-uploaded) photos atomically, return detail (MP-1). */
  create(accessToken: string, command: CreateListingCommand): Promise<Listing>;

  /**
   * Read one listing's full detail (MP-4/7/12). Returns `null` when the listing
   * does not exist or is not visible to the caller; `removed` signals 410 GONE.
   */
  getDetail(
    accessToken: string,
    listingId: string,
  ): Promise<{ listing: Listing | null; removed: boolean }>;

  /** Read just enough of a listing to authorize an edit/delete (owner/admin). */
  getOwnership(accessToken: string, listingId: string): Promise<ListingOwnership | null>;

  /** The listing's current photos (id, url, position) for edit reconcile. */
  getPhotos(accessToken: string, listingId: string): Promise<CurrentPhoto[]>;

  /** Apply a partial scalar-field update / status change (MP-2/8). */
  updateFields(
    accessToken: string,
    listingId: string,
    fields: UpdateListingFields,
  ): Promise<void>;

  /**
   * Reconcile a listing's photos: delete `deletePhotoIds`, then append
   * `newPhotos` starting at `startPosition`. Owner-scoped (RLS-guarded).
   */
  reconcilePhotos(
    accessToken: string,
    listingId: string,
    deletePhotoIds: string[],
    newPhotos: ListingPhotoInput[],
    startPosition: number,
  ): Promise<void>;

  /** Delete a listing the caller owns (MP-3). */
  remove(accessToken: string, listingId: string): Promise<void>;

  /** Save (idempotent) a listing to the caller's wishlist (§7). */
  save(accessToken: string, listingId: string): Promise<void>;

  /** Remove a listing from the caller's wishlist (§7). */
  unsave(accessToken: string, listingId: string): Promise<void>;

  /** The caller's wishlist as ListingCards + total count (§7, 14 Saved). */
  listSaved(accessToken: string, limit: number, offset: number): Promise<SavedListingsResult>;
}
