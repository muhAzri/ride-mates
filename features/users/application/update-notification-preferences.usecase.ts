/**
 * PATCH /me/notification-preferences (§14) — partial update of the caller's
 * notification toggles; returns the refreshed values.
 */
import type { UsersRepository } from '../domain/users.repository';
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesCommand,
} from '../domain/user.types';

export class UpdateNotificationPreferencesUseCase {
  constructor(private readonly repo: UsersRepository) {}

  execute(
    accessToken: string,
    command: UpdateNotificationPreferencesCommand,
  ): Promise<NotificationPreferences> {
    return this.repo.updateNotificationPreferences(accessToken, command);
  }
}
