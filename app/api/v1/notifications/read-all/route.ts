// POST /api/v1/notifications/read-all — "Mark all read" (NT-1) — API_CONTRACT.md §11
import { notificationsController } from '@/features/notifications/notifications.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => notificationsController.markAllRead(request));
