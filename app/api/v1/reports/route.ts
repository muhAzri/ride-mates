// POST /api/v1/reports — polymorphic report (MD-1/2/3) — API_CONTRACT.md §12
import { moderationController } from '@/features/moderation/moderation.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => moderationController.createReport(request));
