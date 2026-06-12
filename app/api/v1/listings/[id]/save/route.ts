// /api/v1/listings/{id}/save — wishlist Heart (06, 07) — API_CONTRACT.md §7
import { listingsController } from '@/features/listings/listings.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return listingsController.save(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return listingsController.unsave(request, id);
});
