/**
 * HTTP boundary for the Realtime transport (API_CONTRACT.md §10). Produces a
 * Server-Sent Events stream (Route Handlers can stream a `Response` body; native
 * WebSocket is not available here). Each event is serialised with the *same* REST
 * mappers, so `message.created` / `notification.created` payloads are byte-identical
 * to §17.6 / §17.7. REST remains the source of truth and the fallback.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBearerToken } from '@/shared/http/responses';
import { ApiError } from '@/shared/http/api-error';
import { toMessageDto } from '@/features/messaging/presentation/messaging.mapper';
import { toNotificationDto } from '@/features/notifications/presentation/notifications.mapper';
import type { RealtimeRepository, RealtimeSubscription } from '../domain/realtime.repository';
import type { RealtimeEvent } from '../domain/realtime.types';

/** Comment-ping interval to keep proxies from closing an idle connection. */
const HEARTBEAT_MS = 25_000;

export class RealtimeController {
  constructor(private readonly repo: RealtimeRepository) {}

  /** GET /realtime — open the per-user event stream. */
  async stream(request: NextRequest): Promise<NextResponse> {
    const accessToken = this.requireToken(request);
    // Validate the token up front so an unauthenticated caller gets a clean 401
    // (the standard error envelope) instead of an opened, immediately-closed stream.
    await this.repo.authenticate(accessToken);

    const encoder = new TextEncoder();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let subscription: RealtimeSubscription | undefined;
    let closed = false;

    const teardown = async () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      await subscription?.unsubscribe();
    };

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const write = (chunk: string) => {
          if (!closed) controller.enqueue(encoder.encode(chunk));
        };
        const sendEvent = (event: RealtimeEvent) => {
          const data =
            event.event === 'message.created'
              ? toMessageDto(event.data)
              : toNotificationDto(event.data);
          write(`event: ${event.event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        // Tell EventSource how long to wait before reconnecting after the stream
        // ends (e.g. the platform duration cap is reached). 3s keeps re-subscribe
        // snappy without hammering the server.
        write('retry: 3000\n\n');
        write('event: ready\ndata: {}\n\n');
        heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);

        try {
          subscription = await this.repo.subscribe(accessToken, sendEvent);
        } catch (error) {
          console.error('[realtime] subscribe failed', error);
          // Could not establish the upstream channel. End the stream so the
          // browser's EventSource reconnects after `retry:` and tries again,
          // rather than holding an open connection that never delivers events.
          write('event: error\ndata: {"message":"Realtime channel is unavailable; reconnecting."}\n\n');
          await teardown();
          try {
            controller.close();
          } catch {
            // already closed by an abort — nothing to do
          }
        }
      },
      cancel: teardown,
    });

    // Client disconnect → tear down the upstream subscription and heartbeat.
    request.signal.addEventListener('abort', () => void teardown());

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Disable proxy buffering so events flush immediately (e.g. nginx).
        'X-Accel-Buffering': 'no',
      },
    });
  }

  /**
   * Bearer token from `Authorization`, or a `?access_token=` fallback. Browser
   * `EventSource` cannot set headers, so the query param is the documented way for
   * web clients to authenticate the stream; native clients use the header.
   */
  private requireToken(request: NextRequest): string {
    const headerToken = getBearerToken(request);
    const queryToken = request.nextUrl.searchParams.get('access_token');
    const token = headerToken ?? (queryToken && queryToken.length > 0 ? queryToken : null);
    if (!token) {
      throw ApiError.unauthenticated('You must be signed in to continue.');
    }
    return token;
  }
}
