// /api/v1/conversations/{id}/messages — list & send (MS-2, MS-3) — API_CONTRACT.md §10
import { messagingController } from '@/features/messaging/messaging.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return messagingController.listMessages(request, id);
});

export const POST = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return messagingController.sendMessage(request, id);
});
