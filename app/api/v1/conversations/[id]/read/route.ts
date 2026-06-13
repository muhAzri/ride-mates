// /api/v1/conversations/{id}/read — advance the read marker (MS-4) — API_CONTRACT.md §10
import { messagingController } from '@/features/messaging/messaging.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return messagingController.markRead(request, id);
});
