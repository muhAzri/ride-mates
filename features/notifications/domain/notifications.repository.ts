/**
 * Notifications data port (Dependency Inversion). The Supabase adapter implements
 * it; all reads/writes are recipient-scoped by RLS (`user_id = auth.uid()`).
 */
import type { Notification } from './notification.types';

export interface NotificationsRepository {
  /** Newest-first page of the caller's notifications (20). Fetches `limit` rows. */
  list(accessToken: string, limit: number, offset: number): Promise<Notification[]>;

  /** Count of the caller's unread notifications (bell badge). */
  unreadCount(accessToken: string): Promise<number>;

  /** Mark one notification read; `false` when it does not exist for the caller. */
  markRead(accessToken: string, notificationId: string): Promise<boolean>;

  /** Mark all the caller's notifications read ("Mark all read"). */
  markAllRead(accessToken: string): Promise<void>;
}
