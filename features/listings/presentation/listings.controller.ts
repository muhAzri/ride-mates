/**
 * HTTP boundary for the Listings feature (API_CONTRACT.md §6, §7). Maps requests
 * to use-cases and results to responses — no business logic, no data access.
 * Create/edit are `application/json`: photos upload pre-signed (R17), so the body
 * carries `photoRefs` instead of file parts.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json, noContent } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput, readJsonBody } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { BrowseListingsUseCase } from '../application/browse-listings.usecase';
import type { CreateListingUseCase } from '../application/create-listing.usecase';
import type { IssuePhotoUploadUrlsUseCase } from '../application/issue-photo-upload-urls.usecase';
import type { GetListingUseCase } from '../application/get-listing.usecase';
import type { UpdateListingUseCase } from '../application/update-listing.usecase';
import type { DeleteListingUseCase } from '../application/delete-listing.usecase';
import type { ListOwnerListingsUseCase } from '../application/list-owner-listings.usecase';
import type { SavedListingsUseCase } from '../application/saved-listings.usecase';
import {
  browseQuerySchema,
  createListingSchema,
  photoUploadUrlsSchema,
  savedQuerySchema,
  updateListingSchema,
} from './listings.schemas';
import type { BrowseQuery, UpdateListingFields } from '../domain/listing.types';
import { toListingCardDto, toListingDto } from './listings.mapper';

export interface ListingsUseCases {
  browse: BrowseListingsUseCase;
  create: CreateListingUseCase;
  issuePhotoUploadUrls: IssuePhotoUploadUrlsUseCase;
  getOne: GetListingUseCase;
  update: UpdateListingUseCase;
  remove: DeleteListingUseCase;
  ownerListings: ListOwnerListingsUseCase;
  saved: SavedListingsUseCase;
}

export class ListingsController {
  constructor(private readonly useCases: ListingsUseCases) {}

  /** GET /listings (MP-4/5/10/11). */
  async browse(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const params = parseInput(
      browseQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const query: BrowseQuery = {
      q: params.q,
      category: params.category,
      condition: params.condition,
      minPriceIdr: params.minPriceIdr,
      maxPriceIdr: params.maxPriceIdr,
      radiusKm: params.radiusKm === 'all' ? null : Number(params.radiusKm),
      exploreBeyond: params.exploreBeyond,
      sort: params.sort,
      status: params.status,
      limit: params.limit,
      offset,
    };

    const page = await this.useCases.browse.execute(accessToken, query);
    return json({ data: page.data.map(toListingCardDto), page: page.page }, 200);
  }

  /** POST /listings/photo-upload-urls (MP-1 / R17). Issue pre-signed photo PUTs. */
  async issuePhotoUploadUrls(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { contentTypes } = parseInput(photoUploadUrlsSchema, await readJsonBody(request));
    const result = await this.useCases.issuePhotoUploadUrls.execute(accessToken, contentTypes);
    return json(result, 200);
  }

  /** POST /listings (MP-1). JSON: fields + `photoRefs` (pre-signed uploads). */
  async create(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { photoRefs, ...fields } = parseInput(createListingSchema, await readJsonBody(request));

    const listing = await this.useCases.create.execute(accessToken, { ...fields, photoRefs });
    return json(toListingDto(listing), 201);
  }

  /** PATCH /listings/{id} (MP-2, MP-8). JSON: fields + photo reconcile via refs. */
  async update(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { keepPhotoIds, photoRefs, ...fields } = parseInput(
      updateListingSchema,
      await readJsonBody(request),
    );

    const newRefs = photoRefs ?? [];
    const photos = {
      touched: keepPhotoIds !== undefined || newRefs.length > 0,
      keepProvided: keepPhotoIds !== undefined,
      keepIds: keepPhotoIds ?? [],
      newRefs,
    };

    const listing = await this.useCases.update.execute(
      accessToken,
      listingId,
      fields as UpdateListingFields,
      photos,
    );
    return json(toListingDto(listing), 200);
  }

  /** GET /listings/{id} (MP-4/7/12). */
  async getOne(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const listing = await this.useCases.getOne.execute(accessToken, listingId);
    return json(toListingDto(listing), 200);
  }

  /** DELETE /listings/{id} (MP-3). */
  async remove(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.remove.execute(accessToken, listingId);
    return noContent();
  }

  /** PUT /listings/{id}/save (§7). */
  async save(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.saved.save(accessToken, listingId);
    return json(result, 200);
  }

  /** DELETE /listings/{id}/save (§7). */
  async unsave(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const result = await this.useCases.saved.unsave(accessToken, listingId);
    return json(result, 200);
  }

  /** GET /users/{userId}/listings (MP-4, 13 Profile › Listings). */
  async listByOwner(request: NextRequest, ownerId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(savedQuerySchema, Object.fromEntries(request.nextUrl.searchParams));
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.ownerListings.execute(accessToken, ownerId, limit, offset);
    return json({ data: page.data.map(toListingCardDto), page: page.page }, 200);
  }

  /** GET /me/saved/listings (§7, 14 Saved). */
  async listSaved(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(
      savedQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const { page, count } = await this.useCases.saved.list(accessToken, limit, offset);
    return json({ data: page.data.map(toListingCardDto), page: page.page, count }, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
