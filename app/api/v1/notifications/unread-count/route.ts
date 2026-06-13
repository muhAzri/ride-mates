// GET /api/v1/notifications/unread-count — bell badge (NT-1) — API_CONTRACT.md §11
import { notificationsController } from '@/features/notifications/notifications.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => notificationsController.unreadCount(request));
