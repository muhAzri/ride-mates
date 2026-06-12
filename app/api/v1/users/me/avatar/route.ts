// POST/DELETE /api/v1/users/me/avatar — UA-4 (auth required) (API_CONTRACT.md §4)
import { usersController } from '@/features/users/users.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => usersController.setAvatar(request));
export const DELETE = withRoute((request) => usersController.removeAvatar(request));
