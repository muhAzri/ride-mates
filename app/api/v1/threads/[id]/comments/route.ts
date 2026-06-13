// /api/v1/threads/{id}/comments — list & add comments (CF-2) — API_CONTRACT.md §8
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.listComments(request, id);
});

export const POST = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.createComment(request, id);
});
