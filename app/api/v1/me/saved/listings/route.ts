// GET /api/v1/me/saved/listings — wishlist grid (14 Saved › Listings) — §7
import { listingsController } from '@/features/listings/listings.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => listingsController.listSaved(request));
