// GET /api/v1/admin/reports — moderation queue (MD-4) — API_CONTRACT.md §15
import { adminController } from '@/features/admin/admin.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => adminController.listReports(request));
