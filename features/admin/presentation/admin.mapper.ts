/**
 * Maps admin domain models to the §15 wire shape (report + snapshot + reporter).
 */
import type { AdminReport, ReporterMini } from '../domain/admin.types';

function toReporterDto(reporter: ReporterMini | null) {
  if (!reporter) return null;
  return {
    id: reporter.id,
    displayName: reporter.displayName,
    avatarUrl: reporter.avatarUrl,
    cyclingType: reporter.cyclingType,
    ratingAverage: reporter.ratingAverage,
  };
}

export function toAdminReportDto(report: AdminReport) {
  return {
    id: report.id,
    reporter: toReporterDto(report.reporter),
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolutionAction: report.resolutionAction,
    resolutionNote: report.resolutionNote,
    resolvedAt: report.resolvedAt,
    createdAt: report.createdAt,
    target: report.target,
  };
}
