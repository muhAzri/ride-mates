// /api/v1/me/notification-preferences — notif toggles (NT-1/NT-2) — API_CONTRACT.md §14
import { usersController } from '@/features/users/users.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => usersController.getNotificationPreferences(request));
export const PATCH = withRoute((request) => usersController.updateNotificationPreferences(request));
