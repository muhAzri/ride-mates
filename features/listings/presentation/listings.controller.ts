/**
 * HTTP boundary for the Listings feature (API_CONTRACT.md §6, §7). Maps requests
 * to use-cases and results to responses — no business logic, no data access.
 * Create/edit are multipart (photos inline); this layer pulls the text fields and
 * file parts out of the form and hands them to the use-cases.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json, noContent } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import {
  getFileParts,
  getOptionalTextField,
  getTextValues,
  hasField,
  readMultipart,
} from '@/shared/http/form-data';
import type { BrowseListingsUseCase } from '../application/browse-listings.usecase';
import type { CreateListingUseCase } from '../application/create-listing.usecase';
import type { GetListingUseCase } from '../application/get-listing.usecase';
import type { UpdateListingUseCase } from '../application/update-listing.usecase';
import type { DeleteListingUseCase } from '../application/delete-listing.usecase';
import type { ListOwnerListingsUseCase } from '../application/list-owner-listings.usecase';
import type { SavedListingsUseCase } from '../application/saved-listings.usecase';
import {
  browseQuerySchema,
  createListingFieldsSchema,
  savedQuerySchema,
  updateListingFieldsSchema,
} from './listings.schemas';
import type { BrowseQuery, UpdateListingFields } from '../domain/listing.types';
import { toListingCardDto, toListingDto } from './listings.mapper';

export interface ListingsUseCases {
  browse: BrowseListingsUseCase;
  create: CreateListingUseCase;
  getOne: GetListingUseCase;
  update: UpdateListingUseCase;
  remove: DeleteListingUseCase;
  ownerListings: ListOwnerListingsUseCase;
  saved: SavedListingsUseCase;
}

const TEXT_FIELDS = ['title', 'description', 'priceIdr', 'category', 'condition', 'status'] as const;

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

  /** POST /listings (MP-1). multipart/form-data: fields + `photos` files. */
  async create(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const form = await readMultipart(request);

    const fields = parseInput(createListingFieldsSchema, collectTextFields(form));
    const photos = await getFileParts(form, 'photos');

    const listing = await this.useCases.create.execute(accessToken, { ...fields, photos });
    return json(toListingDto(listing), 201);
  }

  /** PATCH /listings/{id} (MP-2, MP-8). multipart/form-data: fields + photo reconcile. */
  async update(request: NextRequest, listingId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const form = await readMultipart(request);

    const fields = parseInput(
      updateListingFieldsSchema,
      collectTextFields(form),
    ) as UpdateListingFields;

    const keepProvided = hasField(form, 'keepPhotoIds');
    const newFiles = await getFileParts(form, 'photos');
    const photos = {
      touched: keepProvided || newFiles.length > 0,
      keepProvided,
      keepIds: getTextValues(form, 'keepPhotoIds'),
      newFiles,
    };

    const listing = await this.useCases.update.execute(accessToken, listingId, fields, photos);
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

/**
 * Pull the present listing text fields out of a form into a plain object. Absent
 * fields are omitted (not set to null) so the schema's required/optional rules
 * behave exactly as they would for a JSON body.
 */
function collectTextFields(form: FormData): Record<string, string> {
  const input: Record<string, string> = {};
  for (const field of TEXT_FIELDS) {
    const value = getOptionalTextField(form, field);
    if (value !== null) input[field] = value;
  }
  return input;
}
