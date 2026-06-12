// GET/PATCH /api/v1/users/me — UA-3 (auth required) (API_CONTRACT.md §4)
import { usersController } from '@/features/users/users.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => usersController.getMe(request));
export const PATCH = withRoute((request) => usersController.updateMe(request));
