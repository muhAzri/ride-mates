// POST /api/v1/admin/reports/{id}/resolve — take action (MD-4) — API_CONTRACT.md §15
import { adminController } from '@/features/admin/admin.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return adminController.resolveReport(request, id);
});
