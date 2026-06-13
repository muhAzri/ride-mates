/**
 * Messaging data port (Dependency Inversion). Application use-cases depend on
 * this interface; the Supabase adapter implements it. All reads/writes go through
 * a token-scoped client so RLS / `auth.uid()` run as the caller — non-participants
 * cannot read a conversation or its messages, and the block rule (MD-5) is
 * enforced structurally on insert. Idempotency per pair and the NT-1 new-message
 * notification are owned by DB functions/triggers, so the adapter never re-derives
 * them.
 */
import type {
  Conversation,
  Message,
  OpenConversationCommand,
  SendMessageCommand,
} from './messaging.types';

export interface MessagingRepository {
  /** The caller's conversations with unread counts (MS-4). Fetches `limit` rows. */
  listConversations(accessToken: string, limit: number, offset: number): Promise<Conversation[]>;

  /** Open (or return the existing) 1:1 conversation — idempotent per pair (MP-6, MS-1). */
  openConversation(accessToken: string, command: OpenConversationCommand): Promise<Conversation>;

  /** One conversation, or `null` when the caller is not a participant (MS-1). */
  getConversation(accessToken: string, conversationId: string): Promise<Conversation | null>;

  /** Is the caller a participant of the conversation? (Gates message reads — MS-1.) */
  isParticipant(accessToken: string, conversationId: string): Promise<boolean>;

  /** A conversation's messages, newest-first (MS-2). Fetches `limit` rows. */
  listMessages(
    accessToken: string,
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Message[]>;

  /** Send a message (MS-2, MS-3). RLS rejects non-participants and blocked pairs. */
  sendMessage(
    accessToken: string,
    conversationId: string,
    command: SendMessageCommand,
  ): Promise<Message>;

  /** Mark the conversation read for the caller (MS-4). */
  markRead(accessToken: string, conversationId: string): Promise<void>;
}
