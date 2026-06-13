/**
 * GET /me/notification-preferences (§14) — read the caller's in-app notification
 * toggles (New messages / Replies to my threads).
 */
import type { UsersRepository } from '../domain/users.repository';
import type { NotificationPreferences } from '../domain/user.types';

export class GetNotificationPreferencesUseCase {
  constructor(private readonly repo: UsersRepository) {}

  execute(accessToken: string): Promise<NotificationPreferences> {
    return this.repo.getNotificationPreferences(accessToken);
  }
}
