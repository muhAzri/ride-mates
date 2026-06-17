/**
 * Composition root for the Listings feature — the one place that knows concrete
 * implementations. Wires the Supabase repository + shared object storage into the
 * use-cases (including Saved/Wishlist §7) and exposes a ready controller. Route
 * Handlers import only `listingsController`.
 */
import { getObjectStorage } from '@/shared/storage';
import { SupabaseListingsRepository } from './infrastructure/supabase-listings.repository';
import { BrowseListingsUseCase } from './application/browse-listings.usecase';
import { CreateListingUseCase } from './application/create-listing.usecase';
import { IssuePhotoUploadUrlsUseCase } from './application/issue-photo-upload-urls.usecase';
import { GetListingUseCase } from './application/get-listing.usecase';
import { UpdateListingUseCase } from './application/update-listing.usecase';
import { DeleteListingUseCase } from './application/delete-listing.usecase';
import { ListOwnerListingsUseCase } from './application/list-owner-listings.usecase';
import { SavedListingsUseCase } from './application/saved-listings.usecase';
import { ListingsController } from './presentation/listings.controller';

const repository = new SupabaseListingsRepository();
const storage = getObjectStorage();

export const listingsController = new ListingsController({
  browse: new BrowseListingsUseCase(repository),
  create: new CreateListingUseCase(repository, storage),
  issuePhotoUploadUrls: new IssuePhotoUploadUrlsUseCase(repository, storage),
  getOne: new GetListingUseCase(repository),
  update: new UpdateListingUseCase(repository, storage),
  remove: new DeleteListingUseCase(repository),
  ownerListings: new ListOwnerListingsUseCase(repository),
  saved: new SavedListingsUseCase(repository),
});
