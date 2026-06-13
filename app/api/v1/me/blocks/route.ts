// GET /api/v1/me/blocks — block list (MD-5, Settings 16) — API_CONTRACT.md §12
import { moderationController } from '@/features/moderation/moderation.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => moderationController.listBlocks(request));
