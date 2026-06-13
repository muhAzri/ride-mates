/**
 * Admin data port (Dependency Inversion). The Supabase adapter implements it.
 * The admin gate lives in the use-case (`getViewer().isAdmin`); the DB also
 * backstops it (RLS on reports + `resolve_report`'s internal `is_admin` check).
 */
import type { AdminReport, ListReportsQuery, ResolveReportCommand } from './admin.types';

export interface AdminRepository {
  /** Resolve the caller's user id + admin flag. */
  getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }>;

  /** The moderation queue (MD-4), filtered by status/target. Fetches `limit` rows. */
  listReports(accessToken: string, query: ListReportsQuery): Promise<AdminReport[]>;

  /** One report with its snapshot + reporter, or `null` if missing. */
  getReport(accessToken: string, reportId: string): Promise<AdminReport | null>;

  /** Apply a moderation action via `resolve_report` and return the updated report. */
  resolveReport(
    accessToken: string,
    reportId: string,
    command: ResolveReportCommand,
  ): Promise<AdminReport>;
}
