/**
 * Moderation (user-side) domain models (API_CONTRACT.md §12, §17.8; FSD §5.5
 * MD-1/2/3 reports, MD-5 block). Reactive, report-based: a user files a
 * polymorphic report (queued for admin review) and manages a personal block list.
 */

export type ReportTargetType = 'user' | 'listing' | 'thread' | 'comment';
export type ReportReason =
  | 'spam'
  | 'scam_or_fraud'
  | 'prohibited_item'
  | 'harassment'
  | 'inappropriate'
  | 'something_else';
export type ReportStatus = 'queued' | 'resolved' | 'dismissed';
export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

export interface CreateReportCommand {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  /** Required when `reason === 'something_else'` (15 Report sheet). */
  details?: string;
}

/** What the client gets back after filing a report (§12). */
export interface ReportReceipt {
  id: string;
  status: ReportStatus;
}

/** A blocked user as shown in Settings "Blocked users" (16). */
export interface BlockedUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
  blockedAt: string;
}
