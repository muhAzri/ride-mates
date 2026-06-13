// POST /api/v1/feedback — unified bug/idea/other (FB-2) — API_CONTRACT.md §13
import { feedbackController } from '@/features/feedback/feedback.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => feedbackController.submit(request));
