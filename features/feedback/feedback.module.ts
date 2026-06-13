/**
 * Composition root for the Feedback feature — wires the Supabase repository and
 * shared object storage into the use-cases (feedback, feature requests,
 * changelog) and exposes a ready controller. Route Handlers import only
 * `feedbackController`.
 */
import { getObjectStorage } from '@/shared/storage';
import { SupabaseFeedbackRepository } from './infrastructure/supabase-feedback.repository';
import { SubmitFeedbackUseCase } from './application/submit-feedback.usecase';
import { FeatureRequestsUseCase } from './application/feature-requests.usecase';
import { GetChangelogUseCase } from './application/get-changelog.usecase';
import { FeedbackController } from './presentation/feedback.controller';

const repository = new SupabaseFeedbackRepository();
const storage = getObjectStorage();

export const feedbackController = new FeedbackController({
  submitFeedback: new SubmitFeedbackUseCase(repository, storage),
  featureRequests: new FeatureRequestsUseCase(repository),
  changelog: new GetChangelogUseCase(repository),
});
