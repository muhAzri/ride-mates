/**
 * Marketplace listing domain models (API_CONTRACT.md §6, §7, §17.2; FSD §5.2
 * MP-1..12, LP-1..5). Transport- and store-agnostic. The location-privacy
 * invariant is baked into these shapes: a listing ever only carries
 * `displayArea` + server-computed `distanceKm` — never coordinates (LP-1/2).
 */

export type ListingCategory =
  | 'bike'
  | 'groupset'
  | 'wheels'
  | 'apparel'
  | 'accessory'
  | 'other';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'used';
export type ListingStatus = 'active' | 'sold' | 'inactive';
export type ListingSort = 'nearest' | 'recent';
/** Browse status filter — narrower than `ListingStatus` (no 'inactive' for others). */
export type BrowseStatus = 'active' | 'sold';
export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

/** A listing photo (§17.2). On a ListingCard only the first photo's `url` is set. */
export interface ListingPhoto {
  id: string | null;
  url: string;
  width: number | null;
  height: number | null;
}

/** Seller mini-card on listing detail (§6 — "Budi Santoso · 4.8 · Road cyclist"). */
export interface SellerMini {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
}

/** Browse/search card (§17.2 ListingCard) — no description, no seller block. */
export interface ListingCard {
  id: string;
  title: string;
  priceIdr: number;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  displayArea: string | null;
  distanceKm: number | null;
  /** Only present when `exploreBeyond` is querying (MP-11). */
  withinRadius?: boolean;
  /** First photo only on a card; empty when the listing has none. */
  photos: ListingPhoto[];
  isSavedByMe: boolean;
  createdAt: string;
}

/** Full listing detail (§17.2) returned by `GET /listings/{id}`. */
export interface Listing {
  id: string;
  title: string;
  description: string | null;
  priceIdr: number;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  displayArea: string | null;
  distanceKm: number | null;
  photos: ListingPhoto[];
  seller: SellerMini;
  disclaimer: string;
  isSavedByMe: boolean;
  viewerCanEdit: boolean;
  createdAt: string;
}

/** Query for `GET /listings` (§6). All filters optional; defaults applied upstream. */
export interface BrowseQuery {
  q?: string;
  category?: ListingCategory;
  condition?: ListingCondition;
  minPriceIdr?: number;
  maxPriceIdr?: number;
  /** null === "All" (no radius cap). */
  radiusKm: number | null;
  exploreBeyond: boolean;
  sort: ListingSort;
  status: BrowseStatus;
  limit: number;
  offset: number;
}

/** A photo already uploaded to object storage, ready to persist on a listing. */
export interface ListingPhotoInput {
  url: string;
  width: number | null;
  height: number | null;
}

/** A listing's current photo (for edit reconcile): id + url + order. */
export interface CurrentPhoto {
  id: string;
  url: string;
  position: number;
}

export interface CreateListingCommand {
  title: string;
  description?: string;
  priceIdr: number;
  category: ListingCategory;
  condition: ListingCondition;
  /** 1–3 photos, already uploaded to S3 by the use-case (MP-1). */
  photos: ListingPhotoInput[];
}

/** Partial edit of the scalar fields (MP-2) plus mark-sold/inactive (MP-8). */
export interface UpdateListingFields {
  title?: string;
  description?: string | null;
  priceIdr?: number;
  category?: ListingCategory;
  condition?: ListingCondition;
  status?: ListingStatus;
}
