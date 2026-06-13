// /api/v1/realtime — SSE transport for message.created / notification.created
// (MS-2, NT-1/NT-2) — API_CONTRACT.md §10 "Realtime transport"
import { realtimeController } from '@/features/realtime/realtime.module';
import { withRoute } from '@/shared/http/with-route';

export const runtime = 'nodejs';
// A long-lived stream must never be statically optimised or cached.
export const dynamic = 'force-dynamic';
// Hold the SSE connection up to the platform cap. On Vercel Fluid compute the
// default is 300s on all plans (Pro/Enterprise can raise this to 30 min); when
// the cap is hit the browser's EventSource reconnects and the client reconciles
// missed events via REST (the contract's source of truth — §10).
export const maxDuration = 300;

export const GET = withRoute((request) => realtimeController.stream(request));
