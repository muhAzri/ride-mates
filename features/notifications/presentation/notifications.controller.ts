/**
 * HTTP boundary for the Notifications feature (API_CONTRACT.md §11). Maps requests
 * to the notifications use-case and results to responses — no business logic, no
 * data access.
 */
import type { NextRequest, NextResponse } from 'next/server';
import { getBearerToken, json } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { parseInput } from '@/shared/validation/validate';
import { decodeCursor } from '@/shared/http/pagination';
import type { NotificationsUseCase } from '../application/notifications.usecase';
import { notificationsQuerySchema } from './notifications.schemas';
import { toNotificationDto } from './notifications.mapper';

export interface NotificationsUseCases {
  notifications: NotificationsUseCase;
}

export class NotificationsController {
  constructor(private readonly useCases: NotificationsUseCases) {}

  /** GET /notifications (20). */
  async list(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const { limit } = parseInput(
      notificationsQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const offset = decodeCursor(request.nextUrl.searchParams.get('cursor'));

    const page = await this.useCases.notifications.list(accessToken, limit, offset);
    return json({ data: page.data.map(toNotificationDto), page: page.page }, 200);
  }

  /** GET /notifications/unread-count (bell badge). */
  async unreadCount(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    const count = await this.useCases.notifications.unreadCount(accessToken);
    return json({ count }, 200);
  }

  /** POST /notifications/{id}/read. */
  async markRead(request: NextRequest, notificationId: string): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.notifications.markRead(accessToken, notificationId);
    return json({ readAt: new Date().toISOString() }, 200);
  }

  /** POST /notifications/read-all ("Mark all read"). */
  async markAllRead(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    await this.useCases.notifications.markAllRead(accessToken);
    return json({ ok: true }, 200);
  }

  private requireToken(request: NextRequest): string {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return accessToken;
  }
}
