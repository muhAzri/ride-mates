// POST /api/v1/auth/password/forgot — UA-5 (API_CONTRACT.md §3)
import { authController } from '@/features/auth/auth.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => authController.forgotPassword(request));
