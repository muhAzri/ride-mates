// GET /api/v1/users/{userId} — public profile projection, UA-3 (API_CONTRACT.md §4)
import { usersController } from '@/features/users/users.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(
  async (request, context: RouteContext<{ userId: string }>) => {
    const { userId } = await context.params;
    return usersController.getPublicProfile(request, userId);
  },
);
