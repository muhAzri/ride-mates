/**
 * POST /reports (MD-1/2/3) — file a polymorphic report. Shape (incl. the
 * "something_else needs details" rule) is validated at the boundary; the report
 * is queued for admin review and must not be silently lost (NFR Reliability).
 */
import type { ModerationRepository } from '../domain/moderation.repository';
import type { CreateReportCommand, ReportReceipt } from '../domain/moderation.types';

export class SubmitReportUseCase {
  constructor(private readonly repo: ModerationRepository) {}

  execute(accessToken: string, command: CreateReportCommand): Promise<ReportReceipt> {
    return this.repo.createReport(accessToken, command);
  }
}
