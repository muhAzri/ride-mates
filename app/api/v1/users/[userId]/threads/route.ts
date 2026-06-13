// GET /api/v1/users/{userId}/threads — profile Threads tab (CF-1) — §4
import { forumController } from '@/features/forum/forum.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ userId: string }>) => {
  const { userId } = await context.params;
  return forumController.listByAuthor(request, userId);
});
