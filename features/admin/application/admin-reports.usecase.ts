/**
 * Admin moderation queue (MD-4): list / detail / resolve. Every method gates on
 * the caller being an admin (`403 FORBIDDEN` otherwise) before touching data —
 * RLS would otherwise quietly scope a non-admin to only their own reports.
 */
import { ApiError } from '@/shared/http/api-error';
import { buildPage, type Page } from '@/shared/http/pagination';
import type { AdminRepository } from '../domain/admin.repository';
import type { AdminReport, ListReportsQuery, ResolveReportCommand } from '../domain/admin.types';

export class AdminReportsUseCase {
  constructor(private readonly repo: AdminRepository) {}

  /** GET /admin/reports — paginated queue. */
  async list(accessToken: string, query: ListReportsQuery): Promise<Page<AdminReport>> {
    await this.requireAdmin(accessToken);
    const rows = await this.repo.listReports(accessToken, { ...query, limit: query.limit + 1 });
    return buildPage(rows, query.limit, query.offset);
  }

  /** GET /admin/reports/{id}. */
  async get(accessToken: string, reportId: string): Promise<AdminReport> {
    await this.requireAdmin(accessToken);
    const report = await this.repo.getReport(accessToken, reportId);
    if (!report) {
      throw ApiError.notFound('Report not found.');
    }
    return report;
  }

  /** POST /admin/reports/{id}/resolve. */
  async resolve(
    accessToken: string,
    reportId: string,
    command: ResolveReportCommand,
  ): Promise<AdminReport> {
    await this.requireAdmin(accessToken);
    return this.repo.resolveReport(accessToken, reportId, command);
  }

  private async requireAdmin(accessToken: string): Promise<void> {
    const viewer = await this.repo.getViewer(accessToken);
    if (!viewer.isAdmin) {
      throw ApiError.forbidden('Admin access required.');
    }
  }
}
