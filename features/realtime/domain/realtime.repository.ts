/**
 * Realtime data port (Dependency Inversion). The controller depends on this
 * interface to authenticate a stream and subscribe to the caller's events; the
 * Supabase adapter bridges Postgres change-data-capture to the handler. RLS on
 * the underlying tables scopes the stream to the caller (participant messages,
 * own notifications), so there is no per-subscription filter to pass here.
 */
import type { RealtimeEventHandler } from './realtime.types';

/** A live subscription; calling `unsubscribe` tears down the upstream channel. */
export interface RealtimeSubscription {
  unsubscribe(): Promise<void>;
}

export interface RealtimeRepository {
  /** Validate the bearer token and resolve the caller (so we 401 before streaming). */
  authenticate(accessToken: string): Promise<{ userId: string }>;

  /** Subscribe to the caller's `message.created` / `notification.created` events. */
  subscribe(accessToken: string, onEvent: RealtimeEventHandler): Promise<RealtimeSubscription>;
}
