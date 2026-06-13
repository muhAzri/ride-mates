// GET /api/v1/admin/reports/{id} — report detail (MD-4) — API_CONTRACT.md §15
import { adminController } from '@/features/admin/admin.module';
import { withRoute, type RouteContext } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute(async (request, context: RouteContext<{ id: string }>) => {
  const { id } = await context.params;
  return adminController.getReport(request, id);
});
