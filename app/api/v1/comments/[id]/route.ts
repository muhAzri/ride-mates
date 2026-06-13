// DELETE /api/v1/comments/{id} — owner-only delete (CF-2) — API_CONTRACT.md §8
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return forumController.deleteComment(request, id);
});
