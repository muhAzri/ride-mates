// /api/v1/threads/{id}/bookmark — toggle bookmark (§9) — API_CONTRACT.md §9
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.bookmark(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.removeBookmark(request, id);
});
