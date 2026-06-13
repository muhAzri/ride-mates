/**
 * Moderation data port (Dependency Inversion). The Supabase adapter implements
 * it; reports are insert-self and blocks are owner-managed under RLS.
 */
import type { BlockedUser, CreateReportCommand, ReportReceipt } from './moderation.types';

export interface ModerationRepository {
  /** File a polymorphic report; it is queued for admin review (MD-1/2/3). */
  createReport(accessToken: string, command: CreateReportCommand): Promise<ReportReceipt>;

  /** The caller's block list, newest first (MD-5, Settings 16). */
  listBlocks(accessToken: string): Promise<BlockedUser[]>;

  /** Block a user (idempotent). `self` rejects blocking yourself (422). */
  block(accessToken: string, userId: string): Promise<void>;

  /** Unblock a user (idempotent). */
  unblock(accessToken: string, userId: string): Promise<void>;
}
