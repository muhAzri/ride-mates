/**
 * Notifications (§11, NT-1/NT-2): list, unread count, mark one read, mark all
 * read. Cohesive read-side use-case — rows are produced by DB triggers, so there
 * is no create path. `list` owns cursor pagination (fetch `limit + 1`).
 */
import { ApiError } from '@/shared/http/api-error';
import { buildPage, type Page } from '@/shared/http/pagination';
import type { NotificationsRepository } from '../domain/notifications.repository';
import type { Notification } from '../domain/notification.types';

export class NotificationsUseCase {
  constructor(private readonly repo: NotificationsRepository) {}

  /** GET /notifications — newest-first, paginated. */
  async list(accessToken: string, limit: number, offset: number): Promise<Page<Notification>> {
    const rows = await this.repo.list(accessToken, limit + 1, offset);
    return buildPage(rows, limit, offset);
  }

  /** GET /notifications/unread-count. */
  unreadCount(accessToken: string): Promise<number> {
    return this.repo.unreadCount(accessToken);
  }

  /** POST /notifications/{id}/read — `404` if it isn't the caller's notification. */
  async markRead(accessToken: string, notificationId: string): Promise<void> {
    const ok = await this.repo.markRead(accessToken, notificationId);
    if (!ok) {
      throw ApiError.notFound('Notification not found.');
    }
  }

  /** POST /notifications/read-all. */
  markAllRead(accessToken: string): Promise<void> {
    return this.repo.markAllRead(accessToken);
  }
}
