/**
 * Realtime transport domain models (API_CONTRACT.md §10 "Realtime transport").
 * The channel carries two event kinds whose payloads equal the REST schemas:
 * `message.created` (§17.6) and `notification.created` (§17.7). Events reuse the
 * existing domain models, so the same presentation mappers serialise them and the
 * transport stays byte-identical to REST.
 */
import type { Message } from '@/features/messaging/domain/messaging.types';
import type { Notification } from '@/features/notifications/domain/notification.types';

export type RealtimeEvent =
  | { event: 'message.created'; data: Message }
  | { event: 'notification.created'; data: Notification };

export type RealtimeEventHandler = (event: RealtimeEvent) => void;
