// POST /api/v1/feedback/screenshot-upload-url — FB-2 / R17 (auth required) — API_CONTRACT.md §13
// Issues a pre-signed PUT so an optional feedback screenshot uploads straight to
// object storage; the returned ref is sent back on POST /feedback to attach it.
import { feedbackController } from '@/features/feedback/feedback.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';

export const POST = withRoute((request) => feedbackController.issueScreenshotUploadUrl(request));
