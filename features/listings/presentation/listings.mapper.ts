/**
 * Maps listing domain models to the exact JSON wire shapes (API_CONTRACT.md §6,
 * §17.2). Coordinates never appear — only `displayArea` + `distanceKm` (LP-1/2).
 * `withinRadius` is emitted only when present (i.e. exploreBeyond querying, MP-11).
 */
import type { Listing, ListingCard, ListingPhoto, SellerMini } from '../domain/listing.types';

function toPhotoDto(photo: ListingPhoto) {
  return { id: photo.id, url: photo.url, width: photo.width, height: photo.height };
}

function toSellerDto(seller: SellerMini) {
  return {
    id: seller.id,
    displayName: seller.displayName,
    avatarUrl: seller.avatarUrl,
    cyclingType: seller.cyclingType,
    ratingAverage: seller.ratingAverage,
  };
}

/** ListingCard — browse/search/saved (§17.2). */
export function toListingCardDto(card: ListingCard) {
  return {
    id: card.id,
    title: card.title,
    priceIdr: card.priceIdr,
    category: card.category,
    condition: card.condition,
    status: card.status,
    displayArea: card.displayArea,
    distanceKm: card.distanceKm,
    ...(card.withinRadius !== undefined ? { withinRadius: card.withinRadius } : {}),
    photos: card.photos.map(toPhotoDto),
    isSavedByMe: card.isSavedByMe,
    createdAt: card.createdAt,
  };
}

/** Listing — full detail (§17.2). */
export function toListingDto(listing: Listing) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    priceIdr: listing.priceIdr,
    category: listing.category,
    condition: listing.condition,
    status: listing.status,
    displayArea: listing.displayArea,
    distanceKm: listing.distanceKm,
    photos: listing.photos.map(toPhotoDto),
    seller: toSellerDto(listing.seller),
    disclaimer: listing.disclaimer,
    isSavedByMe: listing.isSavedByMe,
    viewerCanEdit: listing.viewerCanEdit,
    createdAt: listing.createdAt,
  };
}
