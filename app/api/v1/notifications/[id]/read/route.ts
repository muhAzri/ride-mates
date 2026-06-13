// POST /api/v1/notifications/{id}/read — mark one read (NT-1) — API_CONTRACT.md §11
import { notificationsController } from '@/features/notifications/notifications.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return notificationsController.markRead(request, id);
});
