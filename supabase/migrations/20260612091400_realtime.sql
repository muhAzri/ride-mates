-- ============================================================================
-- RideMates — 10 · Realtime transport (GET /realtime → SSE bridge)
-- Source: API_CONTRACT.md §10 ("Realtime transport"), FSD §5.4 MS-2 / §5.6 NT-1.
-- ----------------------------------------------------------------------------
-- The realtime endpoint is a *transport* for `message.created` (§17.6) and
-- `notification.created` (§17.7) events; REST stays the source of truth. We
-- expose INSERTs on `messages` and `notifications` over Supabase Realtime so the
-- server can bridge them to a per-user SSE stream.
--
-- Both tables already enforce RLS (messages_select_participant in migration 04,
-- notifications_select_own in migration 07). `postgres_changes` honours those
-- policies for the authenticated socket, so a client only ever receives its own
-- conversations' messages and its own notifications — the location-privacy and
-- participant guarantees hold on the realtime path exactly as on REST.
--
-- Idempotent: only adds each table if the publication exists and lacks it, so
-- re-running (or a project without the default publication) is a no-op.
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end $$;
