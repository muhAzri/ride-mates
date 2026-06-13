/**
 * Composition root for the Moderation feature — wires the Supabase repository
 * into the report + blocks use-cases and exposes a ready controller. Route
 * Handlers import only `moderationController`.
 */
import { SupabaseModerationRepository } from './infrastructure/supabase-moderation.repository';
import { SubmitReportUseCase } from './application/submit-report.usecase';
import { BlocksUseCase } from './application/blocks.usecase';
import { ModerationController } from './presentation/moderation.controller';

const repository = new SupabaseModerationRepository();

export const moderationController = new ModerationController({
  submitReport: new SubmitReportUseCase(repository),
  blocks: new BlocksUseCase(repository),
});
