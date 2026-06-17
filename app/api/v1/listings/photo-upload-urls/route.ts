// POST /api/v1/listings/photo-upload-urls — MP-1 / R17 (auth required) — API_CONTRACT.md §6
// Issues pre-signed PUTs so listing photos upload straight to object storage; the
// returned refs are sent back on POST/PATCH /listings to attach the photos.
import { listingsController } from '@/features/listings/listings.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => listingsController.issuePhotoUploadUrls(request));
