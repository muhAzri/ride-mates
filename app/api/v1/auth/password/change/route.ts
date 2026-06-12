// POST /api/v1/auth/password/change — UA-5 (auth required) (API_CONTRACT.md §3)
import { authController } from '@/features/auth/auth.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => authController.changePassword(request));
