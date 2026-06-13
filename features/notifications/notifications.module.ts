/**
 * Composition root for the Notifications feature — wires the Supabase repository
 * into the notifications use-case and exposes a ready controller. Route Handlers
 * import only `notificationsController`.
 */
import { SupabaseNotificationsRepository } from './infrastructure/supabase-notifications.repository';
import { NotificationsUseCase } from './application/notifications.usecase';
import { NotificationsController } from './presentation/notifications.controller';

const repository = new SupabaseNotificationsRepository();

export const notificationsController = new NotificationsController({
  notifications: new NotificationsUseCase(repository),
});
