/**
 * Supabase implementation of the `ListingsRepository` port. The only layer that
 * talks to the marketplace tables/RPCs. Distance is produced by SECURITY DEFINER
 * functions (`nearby_listings`, `listing_detail`, `saved_listings_feed`) so
 * coordinates are never read here (LP-1..3). Photo bytes are handled by the
 * use-cases; this layer persists only URLs. All reads/writes go through a
 * token-scoped client so RLS / `auth.uid()` run as the caller.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type {
  ListingOwnership,
  ListingsRepository,
  SavedListingsResult,
} from '../domain/listings.repository';
import type {
  BrowseQuery,
  CreateListingCommand,
  CurrentPhoto,
  Listing,
  ListingCard,
  ListingCategory,
  ListingCondition,
  ListingPhoto,
  ListingPhotoInput,
  ListingStatus,
  UpdateListingFields,
  CyclingType,
} from '../domain/listing.types';
import { LISTING_DISCLAIMER } from '../domain/listing.constants';

type ScopedClient = ReturnType<typeof createScopedClient>;

interface BrowseRow {
  id: string;
  owner_id: string;
  title: string;
  price_idr: number | string;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  display_area: string | null;
  distance_km: number | null;
  within_radius: boolean;
  first_photo_url: string | null;
  created_at: string;
}

interface SavedRow extends Omit<BrowseRow, 'within_radius'> {
  saved_at: string;
  total_count: number | string;
}

interface DetailRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  price_idr: number | string;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  display_area: string | null;
  removed_at: string | null;
  distance_km: number | null;
  is_saved_by_me: boolean;
  photos: Array<{ id: string; url: string; width: number | null; height: number | null }> | null;
  created_at: string;
  seller_id: string;
  seller_display_name: string;
  seller_avatar_url: string | null;
  seller_cycling_type: CyclingType | null;
  seller_rating_average: number | string | null;
}

export class SupabaseListingsRepository implements ListingsRepository {
  async getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }> {
    const supabase = createScopedClient(accessToken);
    const id = await this.requireUserId(supabase, accessToken);
    const { data } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle();
    return { id, isAdmin: (data as { role?: string } | null)?.role === 'admin' };
  }

  async browse(accessToken: string, query: BrowseQuery): Promise<ListingCard[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('nearby_listings', {
      p_q: query.q ?? null,
      p_category: query.category ?? null,
      p_condition: query.condition ?? null,
      p_min_price_idr: query.minPriceIdr ?? null,
      p_max_price_idr: query.maxPriceIdr ?? null,
      p_radius_km: query.radiusKm,
      p_explore_beyond: query.exploreBeyond,
      p_sort: query.sort,
      p_status: query.status,
      p_limit: query.limit,
      p_offset: query.offset,
    });

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] browse failed', error);
      throw ApiError.internal('Could not load listings. Please try again.');
    }

    const rows = (data ?? []) as BrowseRow[];
    const savedIds = await this.savedIdsAmong(
      supabase,
      rows.map((r) => r.id),
    );

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceIdr: Number(row.price_idr),
      category: row.category,
      condition: row.condition,
      status: row.status,
      displayArea: row.display_area,
      distanceKm: row.distance_km,
      ...(query.exploreBeyond ? { withinRadius: row.within_radius } : {}),
      photos: toCardPhotos(row.first_photo_url),
      isSavedByMe: savedIds.has(row.id),
      createdAt: row.created_at,
    }));
  }

  async listByOwner(
    accessToken: string,
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<ListingCard[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('listings')
      .select('id, title, price_idr, category, condition, status, display_area, created_at')
      .eq('owner_id', ownerId)
      .is('removed_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] list by owner failed', error);
      throw ApiError.internal("Could not load the seller's listings. Please try again.");
    }

    const rows = (data ?? []) as Array<{
      id: string;
      title: string;
      price_idr: number | string;
      category: ListingCategory;
      condition: ListingCondition;
      status: ListingStatus;
      display_area: string | null;
      created_at: string;
    }>;
    const ids = rows.map((r) => r.id);
    const [savedIds, firstPhotos] = await Promise.all([
      this.savedIdsAmong(supabase, ids),
      this.firstPhotosFor(supabase, ids),
    ]);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceIdr: Number(row.price_idr),
      category: row.category,
      condition: row.condition,
      status: row.status,
      displayArea: row.display_area,
      distanceKm: null, // not computed for owner-scoped lists (no SECURITY DEFINER hop)
      photos: toCardPhotos(firstPhotos.get(row.id) ?? null),
      isSavedByMe: savedIds.has(row.id),
      createdAt: row.created_at,
    }));
  }

  async create(accessToken: string, command: CreateListingCommand): Promise<Listing> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('create_listing', {
      p_title: command.title,
      p_description: command.description ?? null,
      p_price_idr: command.priceIdr,
      p_category: command.category,
      p_condition: command.condition,
      p_photos: command.photos.map((p) => ({ url: p.url, width: p.width, height: p.height })),
    });

    if (error) throw this.mapCreateError(error);

    const listingId = (Array.isArray(data) ? data[0] : data) as string | null;
    if (!listingId) {
      console.error('[listings] create_listing returned no id');
      throw ApiError.internal('Could not create your listing. Please try again.');
    }

    const { listing } = await this.getDetail(accessToken, listingId);
    if (!listing) {
      console.error('[listings] created listing not readable', listingId);
      throw ApiError.internal();
    }
    return listing;
  }

  async getDetail(
    accessToken: string,
    listingId: string,
  ): Promise<{ listing: Listing | null; removed: boolean }> {
    const supabase = createScopedClient(accessToken);
    const viewer = await this.getViewer(accessToken);

    const { data, error } = await supabase.rpc('listing_detail', { p_id: listingId });
    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] detail failed', error);
      throw ApiError.internal('Could not load the listing. Please try again.');
    }

    const row = (Array.isArray(data) ? data[0] : data) as DetailRow | undefined;
    if (!row) return { listing: null, removed: false };

    const isOwnerOrAdmin = row.owner_id === viewer.id || viewer.isAdmin;
    if (row.removed_at && !isOwnerOrAdmin) return { listing: null, removed: true };
    if (row.status === 'inactive' && !isOwnerOrAdmin) return { listing: null, removed: false };

    return { listing: this.toListing(row, viewer.id), removed: false };
  }

  async getOwnership(accessToken: string, listingId: string): Promise<ListingOwnership | null> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase
      .from('listings')
      .select('owner_id, status, removed_at')
      .eq('id', listingId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] ownership read failed', error);
      throw ApiError.internal();
    }
    if (!data) return null;

    const row = data as { owner_id: string; status: string; removed_at: string | null };
    return { ownerId: row.owner_id, status: row.status, isRemoved: row.removed_at !== null };
  }

  async getPhotos(accessToken: string, listingId: string): Promise<CurrentPhoto[]> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase
      .from('listing_photos')
      .select('id, url, position')
      .eq('listing_id', listingId)
      .order('position', { ascending: true });

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] photos read failed', error);
      throw ApiError.internal();
    }

    return (data as Array<{ id: string; url: string; position: number }>).map((p) => ({
      id: p.id,
      url: p.url,
      position: p.position,
    }));
  }

  async updateFields(
    accessToken: string,
    listingId: string,
    fields: UpdateListingFields,
  ): Promise<void> {
    const supabase = createScopedClient(accessToken);

    const patch: Record<string, unknown> = {};
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.priceIdr !== undefined) patch.price_idr = fields.priceIdr;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.condition !== undefined) patch.condition = fields.condition;
    if (fields.status !== undefined) patch.status = fields.status;

    const { error } = await supabase.from('listings').update(patch).eq('id', listingId);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] field update failed', error);
      throw ApiError.internal('Could not update your listing. Please try again.');
    }
  }

  async reconcilePhotos(
    accessToken: string,
    listingId: string,
    deletePhotoIds: string[],
    newPhotos: ListingPhotoInput[],
    startPosition: number,
  ): Promise<void> {
    const supabase = createScopedClient(accessToken);

    if (deletePhotoIds.length > 0) {
      const { error } = await supabase
        .from('listing_photos')
        .delete()
        .eq('listing_id', listingId)
        .in('id', deletePhotoIds);
      if (error) {
        rethrowIfAuthError(error);
        console.error('[listings] photo delete failed', error);
        throw ApiError.internal('Could not update the listing photos. Please try again.');
      }
    }

    if (newPhotos.length > 0) {
      const rows = newPhotos.map((p, i) => ({
        listing_id: listingId,
        url: p.url,
        width: p.width,
        height: p.height,
        position: startPosition + i,
      }));
      const { error } = await supabase.from('listing_photos').insert(rows);
      if (error) {
        rethrowIfAuthError(error);
        console.error('[listings] photo insert failed', error);
        throw ApiError.internal('Could not update the listing photos. Please try again.');
      }
    }
  }

  async remove(accessToken: string, listingId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const { error } = await supabase.from('listings').delete().eq('id', listingId);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] delete failed', error);
      throw ApiError.internal('Could not delete your listing. Please try again.');
    }
  }

  async save(accessToken: string, listingId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { error } = await supabase
      .from('saved_listings')
      .upsert({ user_id: userId, listing_id: listingId }, { onConflict: 'user_id,listing_id' });

    if (error) {
      rethrowIfAuthError(error);
      if (error.code === '23503') throw ApiError.notFound('Listing not found.');
      console.error('[listings] save failed', error);
      throw ApiError.internal('Could not save the listing. Please try again.');
    }
  }

  async unsave(accessToken: string, listingId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const userId = await this.requireUserId(supabase, accessToken);

    const { error } = await supabase
      .from('saved_listings')
      .delete()
      .eq('user_id', userId)
      .eq('listing_id', listingId);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] unsave failed', error);
      throw ApiError.internal('Could not update your wishlist. Please try again.');
    }
  }

  async listSaved(
    accessToken: string,
    limit: number,
    offset: number,
  ): Promise<SavedListingsResult> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('saved_listings_feed', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] saved feed failed', error);
      throw ApiError.internal('Could not load your saved listings. Please try again.');
    }

    const rows = (data ?? []) as SavedRow[];
    const items: ListingCard[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      priceIdr: Number(row.price_idr),
      category: row.category,
      condition: row.condition,
      status: row.status,
      displayArea: row.display_area,
      distanceKm: row.distance_km,
      photos: toCardPhotos(row.first_photo_url),
      isSavedByMe: true,
      createdAt: row.created_at,
    }));

    const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return { items, totalCount };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireUserId(supabase: ScopedClient, accessToken: string): Promise<string> {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return data.user.id;
  }

  /** Which of the given listing ids the caller has saved (for `isSavedByMe`). */
  private async savedIdsAmong(supabase: ScopedClient, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const { data, error } = await supabase
      .from('saved_listings')
      .select('listing_id')
      .in('listing_id', ids);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] saved lookup failed', error);
      return new Set(); // non-fatal: cards still render, just unsaved
    }
    return new Set((data as Array<{ listing_id: string }>).map((r) => r.listing_id));
  }

  /** First photo URL per listing id (lowest position), for owner-scoped cards. */
  private async firstPhotosFor(
    supabase: ScopedClient,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const { data, error } = await supabase
      .from('listing_photos')
      .select('listing_id, url, position')
      .in('listing_id', ids)
      .order('position', { ascending: true });
    if (error) {
      rethrowIfAuthError(error);
      console.error('[listings] first photos lookup failed', error);
      return new Map();
    }

    const firstByListing = new Map<string, string>();
    for (const row of data as Array<{ listing_id: string; url: string }>) {
      if (!firstByListing.has(row.listing_id)) firstByListing.set(row.listing_id, row.url);
    }
    return firstByListing;
  }

  private toListing(row: DetailRow, viewerId: string): Listing {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      priceIdr: Number(row.price_idr),
      category: row.category,
      condition: row.condition,
      status: row.status,
      displayArea: row.display_area,
      distanceKm: row.distance_km,
      photos: (row.photos ?? []).map(
        (p): ListingPhoto => ({ id: p.id, url: p.url, width: p.width, height: p.height }),
      ),
      seller: {
        id: row.seller_id,
        displayName: row.seller_display_name,
        avatarUrl: row.seller_avatar_url,
        cyclingType: row.seller_cycling_type,
        ratingAverage: row.seller_rating_average === null ? null : Number(row.seller_rating_average),
      },
      disclaimer: LISTING_DISCLAIMER,
      isSavedByMe: row.is_saved_by_me,
      viewerCanEdit: row.owner_id === viewerId,
      createdAt: row.created_at,
    };
  }

  /** Map a `create_listing` error to the right contract code. */
  private mapCreateError(error: PostgrestError): ApiError {
    rethrowIfAuthError(error);
    // create_listing raises 28000 (auth) and 23514 (photo count out of 1..3).
    if (error.code === '28000') {
      return ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    if (error.code === '23514') {
      return ApiError.unprocessable('A listing must have between 1 and 3 photos.', {
        photos: 'Add 1–3 photos.',
      });
    }
    console.error('[listings] create failed', error);
    return ApiError.internal('Could not create your listing. Please try again.');
  }
}

/** A ListingCard carries only the first photo's URL (id/dimensions unknown). */
function toCardPhotos(firstPhotoUrl: string | null): ListingPhoto[] {
  return firstPhotoUrl ? [{ id: null, url: firstPhotoUrl, width: null, height: null }] : [];
}
