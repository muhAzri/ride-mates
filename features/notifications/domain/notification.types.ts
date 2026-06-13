/**
 * Notification domain models (API_CONTRACT.md §11, §17.7; FSD §5.6 NT-1/NT-2).
 * Rows are generated server-side by DB triggers (new message, thread reply), so
 * this feature is read + mark-read only — there is no create path here.
 */

export type NotificationType = 'new_message' | 'thread_reply' | 'thread_upvote' | 'system';
export type CyclingType = 'road' | 'mtb' | 'gravel' | 'folding' | 'casual';

/** Public actor mini-card (§17.1 public). Null for `system` notifications. */
export interface UserMini {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  cyclingType: CyclingType | null;
  ratingAverage: number | null;
}

/** What a notification points at (a conversation/thread/listing). */
export interface NotificationTarget {
  type: string;
  id: string | null;
  preview: string | null;
}

/** A single notification (§17.7). `readAt === null` ⇒ unread (the bell badge). */
export interface Notification {
  id: string;
  type: NotificationType;
  readAt: string | null;
  actor: UserMini | null;
  target: NotificationTarget | null;
  createdAt: string;
}
