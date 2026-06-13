// GET /api/v1/changelog — "What's new" (§12.5) — API_CONTRACT.md §14
import { feedbackController } from '@/features/feedback/feedback.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => feedbackController.changelog(request));
