/**
 * Supabase implementation of the `RealtimeRepository` port. Bridges Supabase
 * Realtime (`postgres_changes`) to the contract's event stream:
 *
 *  - INSERT on `messages`      → `message.created`      (§17.6, MS-2)
 *  - INSERT on `notifications` → `notification.created` (§17.7, NT-1/NT-2)
 *
 * The socket is authorised with the caller's JWT (`realtime.setAuth`), so the
 * same RLS that scopes REST applies here: the caller only receives messages from
 * conversations they participate in and their own notifications. Raw CDC rows are
 * hydrated (shared-listing card, actor mini) into the exact domain models the
 * REST mappers expect.
 *
 * Resilience: the upstream channel auto-reconnects with capped exponential
 * backoff. The *initial* connect gives up after a few tries so the SSE layer can
 * reconnect cleanly; once we've ever subscribed, a mid-stream drop (e.g. hitting
 * the platform's function-duration cap, a network blip) is retried indefinitely
 * until the caller disconnects.
 */
import { createScopedClient } from '@/shared/supabase/server-client';
import { ApiError } from '@/shared/http/api-error';
import type {
  RealtimeRepository,
  RealtimeSubscription,
} from '../domain/realtime.repository';
import type { RealtimeEventHandler } from '../domain/realtime.types';
import type { CyclingType, ListingRef } from '@/features/messaging/domain/messaging.types';
import type { NotificationType, UserMini } from '@/features/notifications/domain/notification.types';

type ScopedClient = ReturnType<typeof createScopedClient>;
type UserChannel = ReturnType<ScopedClient['channel']>;

const MINI_COLUMNS = 'id, display_name, avatar_url, cycling_type, rating_average';

/** Backoff bounds + how many failed first-connect attempts before giving up. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;
const MAX_INITIAL_ATTEMPTS = 3;

interface MessageCdcRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  listing_ref: string | null;
  created_at: string;
}

interface NotificationCdcRow {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  preview: string | null;
  read_at: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cycling_type: CyclingType | null;
  rating_average: number | string | null;
}

interface ListingRow {
  id: string;
  title: string;
  price_idr: number | string;
  listing_photos: Array<{ url: string; position: number }> | null;
}

export class SupabaseRealtimeRepository implements RealtimeRepository {
  async authenticate(accessToken: string): Promise<{ userId: string }> {
    const supabase = createScopedClient(accessToken);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw ApiError.unauthenticated('Your session has expired. Please sign in again.');
    }
    return { userId: data.user.id };
  }

  async subscribe(
    accessToken: string,
    onEvent: RealtimeEventHandler,
  ): Promise<RealtimeSubscription> {
    const supabase = createScopedClient(accessToken);
    // Authorise the socket so postgres_changes honour the tables' RLS policies.
    supabase.realtime.setAuth(accessToken);

    let stopped = false;
    let failures = 0;
    let settled = false;
    /** Bumped each (re)connect so a torn-down channel's late callbacks are ignored. */
    let generation = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: UserChannel | null = null;

    let resolveInitial!: () => void;
    let rejectInitial!: (error: unknown) => void;
    const initial = new Promise<void>((resolve, reject) => {
      resolveInitial = resolve;
      rejectInitial = reject;
    });

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return; // coalesce overlapping triggers
      failures += 1;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** (failures - 1), RECONNECT_MAX_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (stopped) return;
        generation += 1; // invalidate the old channel's callbacks before tearing it down
        const previous = channel;
        channel = null;
        if (previous) void supabase.removeChannel(previous);
        connect(generation);
      }, delay);
    };

    const connect = (gen: number) => {
      if (stopped) return;
      channel = this.buildChannel(supabase, onEvent).subscribe((status) => {
        if (stopped || gen !== generation) return; // stale channel → ignore
        if (status === 'SUBSCRIBED') {
          failures = 0;
          if (!settled) {
            settled = true;
            resolveInitial();
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (!settled && failures >= MAX_INITIAL_ATTEMPTS - 1) {
            settled = true;
            rejectInitial(new Error(`Realtime channel ${status}`));
            return;
          }
          scheduleReconnect();
        }
      });
    };

    generation = 1;
    connect(generation);
    await initial;

    return {
      unsubscribe: async () => {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (channel) await supabase.removeChannel(channel);
      },
    };
  }

  /** Build a channel wired to the caller's message + notification INSERTs. */
  private buildChannel(supabase: ScopedClient, onEvent: RealtimeEventHandler): UserChannel {
    return supabase
      .channel('rt-user-stream')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          void this.emitMessage(supabase, payload.new as unknown as MessageCdcRow, onEvent);
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          void this.emitNotification(payload.new as unknown as NotificationCdcRow, supabase, onEvent);
        },
      );
  }

  // ── hydration ───────────────────────────────────────────────────────────────

  private async emitMessage(
    supabase: ScopedClient,
    row: MessageCdcRow,
    onEvent: RealtimeEventHandler,
  ): Promise<void> {
    try {
      const listingRef = row.listing_ref
        ? await this.fetchListingRef(supabase, row.listing_ref)
        : null;
      onEvent({
        event: 'message.created',
        data: {
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          body: row.body,
          listingRef,
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      console.error('[realtime] message hydrate failed', error);
    }
  }

  private async emitNotification(
    row: NotificationCdcRow,
    supabase: ScopedClient,
    onEvent: RealtimeEventHandler,
  ): Promise<void> {
    try {
      const actor = row.actor_id ? await this.fetchActor(supabase, row.actor_id) : null;
      onEvent({
        event: 'notification.created',
        data: {
          id: row.id,
          type: row.type,
          readAt: row.read_at,
          actor,
          target: row.target_type
            ? { type: row.target_type, id: row.target_id, preview: row.preview }
            : null,
          createdAt: row.created_at,
        },
      });
    } catch (error) {
      console.error('[realtime] notification hydrate failed', error);
    }
  }

  private async fetchListingRef(
    supabase: ScopedClient,
    listingId: string,
  ): Promise<ListingRef | null> {
    const { data } = await supabase
      .from('listings')
      .select('id, title, price_idr, listing_photos(url, position)')
      .eq('id', listingId)
      .maybeSingle();
    if (!data) return null;
    const listing = data as ListingRow;
    const photos = [...(listing.listing_photos ?? [])].sort((a, b) => a.position - b.position);
    return {
      id: listing.id,
      title: listing.title,
      priceIdr: Number(listing.price_idr),
      photoUrl: photos[0]?.url ?? null,
    };
  }

  private async fetchActor(supabase: ScopedClient, actorId: string): Promise<UserMini | null> {
    const { data } = await supabase.from('profiles').select(MINI_COLUMNS).eq('id', actorId).maybeSingle();
    if (!data) return null;
    const row = data as ProfileRow;
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      cyclingType: row.cycling_type,
      ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
    };
  }
}
