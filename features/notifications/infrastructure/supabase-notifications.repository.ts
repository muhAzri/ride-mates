/**
 * Supabase implementation of the `NotificationsRepository` port. Recipient-scoped
 * by RLS (`notifications.user_id = auth.uid()`); rows are inserted only by
 * security-definer triggers, never here. The actor mini-card is fetched with a
 * PostgREST embed on `profiles` (public-read), null for `system` rows.
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { NotificationsRepository } from '../domain/notifications.repository';
import type {
  CyclingType,
  Notification,
  NotificationType,
  UserMini,
} from '../domain/notification.types';

const ACTOR_EMBED = 'actor:profiles!actor_id(id, display_name, avatar_url, cycling_type, rating_average)';
const NOTIFICATION_SELECT =
  `id, type, target_type, target_id, preview, read_at, created_at, ${ACTOR_EMBED}`;

interface ActorRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  target_type: string | null;
  target_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
  actor: ActorRow | ActorRow[] | null;
}

export class SupabaseNotificationsRepository implements NotificationsRepository {
  async list(accessToken: string, limit: number, offset: number): Promise<Notification[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('notifications')
      .select(NOTIFICATION_SELECT)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[notifications] list failed', error);
      throw ApiError.internal('Could not load your notifications. Please try again.');
    }

    return (data as NotificationRow[]).map(toNotification);
  }

  async unreadCount(accessToken: string): Promise<number> {
    const supabase = createScopedClient(accessToken);

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[notifications] unread count failed', error);
      throw ApiError.internal();
    }
    return count ?? 0;
  }

  async markRead(accessToken: string, notificationId: string): Promise<boolean> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('id');

    if (error) {
      rethrowIfAuthError(error);
      console.error('[notifications] mark read failed', error);
      throw ApiError.internal();
    }
    // RLS scopes the update to the caller; 0 rows ⇒ not theirs / missing.
    return (data as Array<{ id: string }>).length > 0;
  }

  async markAllRead(accessToken: string): Promise<void> {
    const supabase = createScopedClient(accessToken);
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (error) {
      rethrowIfAuthError(error);
      console.error('[notifications] mark all read failed', error);
      throw ApiError.internal();
    }
  }
}

function toActor(raw: ActorRow | ActorRow[] | null): UserMini | null {
  const a = Array.isArray(raw) ? raw[0] : raw;
  if (!a) return null;
  return {
    id: a.id,
    displayName: a.display_name,
    avatarUrl: a.avatar_url,
    cyclingType: a.cycling_type,
    ratingAverage: a.rating_average === null ? null : Number(a.rating_average),
  };
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    readAt: row.read_at,
    actor: toActor(row.actor),
    target: row.target_type
      ? { type: row.target_type, id: row.target_id, preview: row.preview }
      : null,
    createdAt: row.created_at,
  };
}
