// /api/v1/threads/{id} — detail (CF-2) & delete (CF-1) — API_CONTRACT.md §8
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.getThread(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.deleteThread(request, id);
});
