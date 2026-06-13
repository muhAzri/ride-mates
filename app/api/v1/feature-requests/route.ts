// /api/v1/feature-requests — board list & propose (FB-3) — API_CONTRACT.md §13
import { feedbackController } from '@/features/feedback/feedback.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const GET = withRoute((request) => feedbackController.listFeatureRequests(request));
export const POST = withRoute((request) => feedbackController.createFeatureRequest(request));
