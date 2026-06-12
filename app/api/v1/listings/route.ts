// /api/v1/listings — browse (MP-4/5/10/11) & create (MP-1) — API_CONTRACT.md §6
import { listingsController } from '@/features/listings/listings.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => listingsController.browse(request));
export const POST = withRoute((request) => listingsController.create(request));
