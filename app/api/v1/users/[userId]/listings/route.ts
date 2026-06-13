// GET /api/v1/users/{userId}/listings — profile Listings tab (MP-4) — §4
import { listingsController } from '@/features/listings/listings.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ userId: string }>) => {
  const { userId } = await context.params;
  return listingsController.listByOwner(request, userId);
});
