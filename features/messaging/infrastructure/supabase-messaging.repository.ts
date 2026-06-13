/**
 * Supabase implementation of the `MessagingRepository` port. The only layer that
 * talks to the messaging tables/functions. Everything goes through a token-scoped
 * client so RLS / `auth.uid()` run as the caller:
 *
 *  - Idempotency per pair + the block rule live in `get_or_create_conversation`
 *    (MP-6, MS-1, MD-5); we call the RPC rather than re-implement it.
 *  - The conversation list + unread counts come from `my_conversations` (MS-4).
 *  - Sending relies on the `messages` RLS insert policy to reject non-participants
 *    and blocked pairs — those surface as `42501`, which we map to `403`.
 *
 * A shared listing reference (MS-3) is fetched with a PostgREST embed on
 * `listings`; the participant mini-card is read from `profiles` (public-read).
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { rethrowIfAuthError } from '@/shared/supabase/errors';
import { ApiError } from '@/shared/http/api-error';
import type { MessagingRepository } from '../domain/messaging.repository';
import type {
  Conversation,
  CyclingType,
  ListingRef,
  Message,
  OpenConversationCommand,
  SendMessageCommand,
  UserMini,
} from '../domain/messaging.types';

type ScopedClient = ReturnType<typeof createScopedClient>;

const MINI_COLUMNS = 'id, display_name, avatar_url, cycling_type, rating_average';
const LISTING_EMBED =
  'listing:listings!listing_ref(id, title, price_idr, listing_photos(url, position))';
const MESSAGE_SELECT = `id, conversation_id, sender_id, body, created_at, ${LISTING_EMBED}`;

const EPOCH = '1970-01-01T00:00:00Z';

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface ConversationRow {
  id: string;
  user_a: string;
  user_b: string;
  listing_ref: string | null;
  last_message_at: string | null;
  created_at?: string;
}

interface MyConversationRow {
  id: string;
  other_user_id: string;
  listing_ref: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number | string;
}

interface ListingRefRow {
  id: string;
  title: string;
  price_idr: number | string;
  listing_photos: Array<{ url: string; position: number }> | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  created_at: string;
  listing: ListingRefRow | ListingRefRow[] | null;
}

export class SupabaseMessagingRepository implements MessagingRepository {
  async listConversations(
    accessToken: string,
    limit: number,
    offset: number,
  ): Promise<Conversation[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('my_conversations', {
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      rethrowIfAuthError(error);
      console.error('[messaging] list conversations failed', error);
      throw ApiError.internal('Could not load your conversations. Please try again.');
    }

    const rows = (data ?? []) as MyConversationRow[];
    const minis = await this.fetchUserMinis(supabase, rows.map((r) => r.other_user_id));

    return rows.map((row) => ({
      id: row.id,
      otherParticipant: minis.get(row.other_user_id) ?? emptyMini(row.other_user_id),
      lastMessagePreview: row.last_message_preview,
      lastMessageAt: row.last_message_at,
      unreadCount: Number(row.unread_count),
    }));
  }

  async openConversation(
    accessToken: string,
    command: OpenConversationCommand,
  ): Promise<Conversation> {
    const supabase = createScopedClient(accessToken);
    const callerId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase.rpc('get_or_create_conversation', {
      p_other_user: command.recipientId,
      p_listing_ref: command.listingRef ?? null,
    });
    if (error || !data) {
      rethrowIfAuthError(error);
      const message = error?.message ?? '';
      if (/blocked/i.test(message)) {
        throw ApiError.forbidden('You can no longer start a conversation with this user.');
      }
      if (/yourself/i.test(message)) {
        throw ApiError.unprocessable("You can't start a conversation with yourself.");
      }
      if (error?.code === '23503') {
        throw ApiError.notFound('That user could not be found.');
      }
      console.error('[messaging] open conversation failed', error);
      throw ApiError.internal('Could not open the conversation. Please try again.');
    }

    // A function returning a composite type comes back as a single row object.
    const row = (Array.isArray(data) ? data[0] : data) as ConversationRow;
    return this.hydrateConversation(supabase, row, callerId);
  }

  async getConversation(
    accessToken: string,
    conversationId: string,
  ): Promise<Conversation | null> {
    const supabase = createScopedClient(accessToken);
    const callerId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_a, user_b, listing_ref, last_message_at')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) {
      rethrowIfAuthError(error);
      console.error('[messaging] get conversation failed', error);
      throw ApiError.internal('Could not load the conversation. Please try again.');
    }
    if (!data) return null; // not a participant (RLS) or missing → caller maps to 403

    return this.hydrateConversation(supabase, data as ConversationRow, callerId);
  }

  async isParticipant(accessToken: string, conversationId: string): Promise<boolean> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase.rpc('is_conversation_participant', {
      p_conversation: conversationId,
    });
    if (error) {
      rethrowIfAuthError(error);
      console.error('[messaging] participant check failed', error);
      throw ApiError.internal();
    }
    return data === true;
  }

  async listMessages(
    accessToken: string,
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Message[]> {
    const supabase = createScopedClient(accessToken);

    const { data, error } = await supabase
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      rethrowIfAuthError(error);
      console.error('[messaging] list messages failed', error);
      throw ApiError.internal('Could not load the messages. Please try again.');
    }

    return (data as MessageRow[]).map(toMessage);
  }

  async sendMessage(
    accessToken: string,
    conversationId: string,
    command: SendMessageCommand,
  ): Promise<Message> {
    const supabase = createScopedClient(accessToken);
    const senderId = await this.requireUserId(supabase, accessToken);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body: command.body ?? null,
        listing_ref: command.listingRef ?? null,
      })
      .select(MESSAGE_SELECT)
      .single();

    if (error || !data) {
      rethrowIfAuthError(error);
      // RLS rejection: not a participant, or blocked pair (MD-5).
      if (error?.code === '42501') {
        throw ApiError.forbidden('You can no longer send messages in this conversation.');
      }
      // FK violation: the conversation or shared listing no longer exists.
      if (error?.code === '23503') {
        throw ApiError.unprocessable('The conversation or shared listing no longer exists.');
      }
      console.error('[messaging] send message failed', error);
      throw ApiError.internal('Could not send your message. Please try again.');
    }

    return toMessage(data as MessageRow);
  }

  async markRead(accessToken: string, conversationId: string): Promise<void> {
    const supabase = createScopedClient(accessToken);

    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation: conversationId,
    });
    if (error) {
      rethrowIfAuthError(error);
      if (/participant/i.test(error.message ?? '')) {
        throw ApiError.forbidden('You are not a participant in this conversation.');
      }
      console.error('[messaging] mark read failed', error);
      throw ApiError.internal('Could not update the conversation. Please try again.');
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async requireUserId(supabase: ScopedClient, accessToken: string): Promise<string> {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return data.user.id;
  }

  /** Fill a conversation's participant mini, last-message preview, and unread count. */
  private async hydrateConversation(
    supabase: ScopedClient,
    row: ConversationRow,
    callerId: string,
  ): Promise<Conversation> {
    const otherId = row.user_a === callerId ? row.user_b : row.user_a;
    const [mini, preview, unreadCount] = await Promise.all([
      this.fetchUserMini(supabase, otherId),
      this.fetchLastPreview(supabase, row.id),
      this.fetchUnreadCount(supabase, row.id, callerId),
    ]);
    return {
      id: row.id,
      otherParticipant: mini,
      lastMessagePreview: preview,
      lastMessageAt: row.last_message_at,
      unreadCount,
    };
  }

  private async fetchUserMini(supabase: ScopedClient, userId: string): Promise<UserMini> {
    const { data } = await supabase.from('profiles').select(MINI_COLUMNS).eq('id', userId).maybeSingle();
    return data ? toUserMini(data as ProfileRow) : emptyMini(userId);
  }

  private async fetchUserMinis(
    supabase: ScopedClient,
    userIds: string[],
  ): Promise<Map<string, UserMini>> {
    const ids = Array.from(new Set(userIds));
    if (ids.length === 0) return new Map();
    const { data, error } = await supabase.from('profiles').select(MINI_COLUMNS).in('id', ids);
    if (error) {
      rethrowIfAuthError(error);
      console.error('[messaging] participant lookup failed', error);
      return new Map(); // non-fatal: render with placeholder minis
    }
    return new Map((data as ProfileRow[]).map((p) => [p.id, toUserMini(p)]));
  }

  private async fetchLastPreview(
    supabase: ScopedClient,
    conversationId: string,
  ): Promise<string | null> {
    const { data } = await supabase
      .from('messages')
      .select('body')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { body: string | null } | null)?.body ?? null;
  }

  private async fetchUnreadCount(
    supabase: ScopedClient,
    conversationId: string,
    callerId: string,
  ): Promise<number> {
    const { data: read } = await supabase
      .from('conversation_reads')
      .select('last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', callerId)
      .maybeSingle();
    const since = (read as { last_read_at: string } | null)?.last_read_at ?? EPOCH;

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', callerId)
      .gt('created_at', since);
    return count ?? 0;
  }
}

function toUserMini(row: ProfileRow): UserMini {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    cyclingType: row.cycling_type,
    ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
  };
}

/** Placeholder for a participant whose profile could not be read (deleted/hidden). */
function emptyMini(id: string): UserMini {
  return { id, displayName: '', avatarUrl: null, cyclingType: null, ratingAverage: null };
}

function toListingRef(raw: ListingRefRow | ListingRefRow[] | null): ListingRef | null {
  const listing = Array.isArray(raw) ? raw[0] : raw;
  if (!listing) return null;
  const photos = [...(listing.listing_photos ?? [])].sort((a, b) => a.position - b.position);
  return {
    id: listing.id,
    title: listing.title,
    priceIdr: Number(listing.price_idr),
    photoUrl: photos[0]?.url ?? null,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    listingRef: toListingRef(row.listing),
    createdAt: row.created_at,
  };
}
