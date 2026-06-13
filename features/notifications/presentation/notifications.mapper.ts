/**
 * Maps notification domain models to the §17.7 wire shape. The 20 screen buckets
 * New/Earlier client-side on `readAt === null`, so the server just returns the
 * fields newest-first.
 */
import type { Notification, UserMini } from '../domain/notification.types';

function toActorDto(actor: UserMini | null) {
  if (!actor) return null;
  return {
    id: actor.id,
    displayName: actor.displayName,
    avatarUrl: actor.avatarUrl,
    cyclingType: actor.cyclingType,
    ratingAverage: actor.ratingAverage,
  };
}

export function toNotificationDto(n: Notification) {
  return {
    id: n.id,
    type: n.type,
    readAt: n.readAt,
    actor: toActorDto(n.actor),
    target: n.target,
    createdAt: n.createdAt,
  };
}
