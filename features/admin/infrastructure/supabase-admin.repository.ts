/**
 * Supabase implementation of the `AdminRepository` port. Admins read the whole
 * reports queue (RLS `reports_select_own_or_admin`) and resolve via the
 * `resolve_report` SECURITY DEFINER RPC. The reported-content snapshot is a
 * best-effort short preview fetched per target type (admins can read removed
 * content through the `is_admin()` RLS branches).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { AdminRepository } from '../domain/admin.repository';
import type {
  AdminReport,
  CyclingType,
  ListReportsQuery,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  ReporterMini,
  ResolveReportCommand,
} from '../domain/admin.types';

type ScopedClient = ReturnType<typeof createScopedClient>;

const REPORTER_EMBED = 'reporter:profiles!reporter_id(id, display_name, avatar_url, cycling_type, rating_average)';
const REPORT_SELECT =
  `id, reporter_id, target_type, target_id, reason, details, status, resolution_action, resolution_note, resolved_at, created_at, ${REPORTER_EMBED}`;

const PREVIEW_LENGTH = 160;

interface ReporterRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution_action: ReportAction | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  reporter: ReporterRow | ReporterRow[] | null;
}

export class SupabaseAdminRepository implements AdminRepository {
  async getViewer(accessToken: string): Promise<{ id: string; isAdmin: boolean }> {
    const supabase = createScopedClient(accessToken);
    const { data: authUser, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authUser.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.user.id)
      .maybeSingle();
    return { id: authUser.user.id, isAdmin: (data as { role?: string } | null)?.role === 'admin' };
  }

  async listReports(accessToken: string, query: ListReportsQuery): Promise<AdminReport[]> {
    const supabase = createScopedClient(accessToken);

    let qb = supabase.from('reports').select(REPORT_SELECT).eq('status', query.status);
    if (query.targetType) qb = qb.eq('target_type', query.targetType);

    const { data, error } = await qb
      .order('created_at', { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[admin] list reports failed', error);
      throw ApiError.internal('Could not load the moderation queue. Please try again.');
    }

    const rows = (data ?? []) as ReportRow[];
    return Promise.all(
      rows.map(async (row) => toAdminReport(row, await this.targetPreview(supabase, row))),
    );
  }

  async getReport(accessToken: string, reportId: string): Promise<AdminReport | null> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('reports')
      .select(REPORT_SELECT)
      .eq('id', reportId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[admin] get report failed', error);
      throw ApiError.internal();
    }
    if (!data) return null;

    const row = data as ReportRow;
    return toAdminReport(row, await this.targetPreview(supabase, row));
  }

  async resolveReport(
    accessToken: string,
    reportId: string,
    command: ResolveReportCommand,
  ): Promise<AdminReport> {
    const supabase = createScopedClient(accessToken);

    const { error } = await supabase.rpc('resolve_report', {
      p_report_id: reportId,
      p_action: command.action,
      p_note: command.note ?? null,
    });

    if (error) {
      rethrowIfAuthError(error);
      const message = error.message ?? '';
      if (/not found/i.test(message)) throw ApiError.notFound('Report not found.');
      if (/admin/i.test(message)) throw ApiError.forbidden('Admin access required.');
      console.error('[admin] resolve report failed', error);
      throw ApiError.internal('Could not resolve the report. Please try again.');
    }

    const updated = await this.getReport(accessToken, reportId);
    if (!updated) {
      console.error('[admin] resolved report not readable', reportId);
      throw ApiError.internal();
    }
    return updated;
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Best-effort short preview of the reported content (null if gone/unknown). */
  private async targetPreview(supabase: ScopedClient, row: ReportRow): Promise<string | null> {
    const { target_type: type, target_id: id } = row;
    if (type === 'listing') return this.previewField(supabase, 'listings', id, 'title');
    if (type === 'thread') return this.previewField(supabase, 'threads', id, 'title');
    if (type === 'comment') return this.previewField(supabase, 'comments', id, 'body');
    if (type === 'user') return this.previewField(supabase, 'profiles', id, 'display_name');
    return null;
  }

  private async previewField(
    supabase: ScopedClient,
    table: 'listings' | 'threads' | 'comments' | 'profiles',
    id: string,
    column: string,
  ): Promise<string | null> {
    const { data, error } = await supabase.from(table).select(column).eq('id', id).maybeSingle();
    if (error || !data) return null;
    const value = (data as unknown as Record<string, unknown>)[column];
    if (typeof value !== 'string') return null;
    return value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}…` : value;
  }
}

function toReporter(raw: ReporterRow | ReporterRow[] | null): ReporterMini | null {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (!r) return null;
  return {
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    cyclingType: r.cycling_type,
    ratingAverage: r.rating_average === null ? null : Number(r.rating_average),
  };
}

function toAdminReport(row: ReportRow, preview: string | null): AdminReport {
  return {
    id: row.id,
    reporter: toReporter(row.reporter),
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolutionAction: row.resolution_action,
    resolutionNote: row.resolution_note,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    target: { type: row.target_type, id: row.target_id, preview },
  };
}
