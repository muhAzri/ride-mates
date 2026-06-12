// /api/v1/listings/{id} — detail (MP-4/7/12), edit (MP-2/8), delete (MP-3) — §6
import { listingsController } from '@/features/listings/listings.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return listingsController.getOne(request, id);
});

export const PATCH = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return listingsController.update(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return listingsController.remove(request, id);
});
