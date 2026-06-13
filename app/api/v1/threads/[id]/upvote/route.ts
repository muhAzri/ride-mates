// /api/v1/threads/{id}/upvote — toggle upvote (CF-3) — API_CONTRACT.md §8
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.upvote(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.removeUpvote(request, id);
});
