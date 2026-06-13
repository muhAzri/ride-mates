/**
 * Composition root for the Realtime feature — wires the Supabase realtime adapter
 * into the controller and exposes it. The route handler imports only
 * `realtimeController`.
 */
import { SupabaseRealtimeRepository } from './infrastructure/supabase-realtime.repository';
import { RealtimeController } from './presentation/realtime.controller';

export const realtimeController = new RealtimeController(new SupabaseRealtimeRepository());
