// /api/v1/feature-requests/{id}/vote — toggle vote (FB-3) — API_CONTRACT.md §13
import { feedbackController } from '@/features/feedback/feedback.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const PUT = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return feedbackController.vote(request, id);
});

export const DELETE = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return feedbackController.unvote(request, id);
});
