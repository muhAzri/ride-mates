// /api/v1/users/{userId}/block — block / unblock a user (MD-5) — API_CONTRACT.md §12
import { moderationController } from '@/features/moderation/moderation.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute(async (request, context: RouteContext<{ userId: string }>) => {
  const { userId } = await context.params;
  return moderationController.block(request, userId);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ userId: string }>) => {
  const { userId } = await context.params;
  return moderationController.unblock(request, userId);
});
