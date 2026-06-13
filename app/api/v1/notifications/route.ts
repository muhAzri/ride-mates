// GET /api/v1/notifications — list (NT-1/NT-2) — API_CONTRACT.md §11
import { notificationsController } from '@/features/notifications/notifications.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => notificationsController.list(request));
