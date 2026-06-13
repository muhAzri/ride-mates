/**
 * Admin moderation-queue domain models (API_CONTRACT.md §15; FSD MD-4). Admin-only
 * (`profiles.role = 'admin'`). A queue item is the report + a snapshot of the
 * reported content (a short preview) + the reporter's public mini.
 */

export type ReportStatus = 'queued' | 'resolved' | 'dismissed';
export type ReportTargetType = 'user' | 'listing' | 'thread' | 'comment';
export type ReportReason =
  | 'spam'
  | 'scam_or_fraud'
  | 'prohibited_item'
  | 'harassment'
  | 'inappropriate'
  | 'something_else';
export type ReportAction = 'remove_content' | 'dismiss' | 'warn_user';
export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

export interface ReporterMini {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
}

/** A snapshot reference to the reported content (preview is best-effort). */
export interface ReportedTarget {
  type: ReportTargetType;
  id: string;
  preview: string | null;
}

export interface AdminReport {
  id: string;
  reporter: ReporterMini | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionAction: ReportAction | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  target: ReportedTarget;
}

export interface ListReportsQuery {
  status: ReportStatus;
  targetType?: ReportTargetType;
  limit: number;
  offset: number;
}

export interface ResolveReportCommand {
  action: ReportAction;
  note?: string;
}
