-- ============================================================================
-- RideMates — 07 · Notifications (in-app) + fan-out triggers
-- Source: FSD §5.6 (NT-1 new message MUST, NT-2 thread reply SHOULD);
--         API_CONTRACT.md §11, §17.7. Push (NT-3) is Growth — in-app only.
-- ----------------------------------------------------------------------------
-- Notifications are generated server-side by triggers and respect each user's
-- preference toggles in user_settings (set on Settings 16). The 20 Notifications
-- screen reads `notifications`; the Bell badge reads the unread count.
-- ============================================================================

create table public.notifications (
  id           uuid primary key default extensions.gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,  -- recipient
  type         public.notification_type not null,
  actor_id     uuid references public.profiles (id) on delete set null,          -- null for 'system'
  target_type  text,                                                             -- conversation|thread|listing
  target_id    uuid,
  preview      text,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_user_idx        on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ----------------------------------------------------------------------------
-- Re-define on_message_insert to ALSO fan out a new-message notification to the
-- recipient (NT-1), gated by their notif_new_messages toggle.
-- ----------------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recipient uuid;
  v_wants boolean;
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id
   returning case when user_a = new.sender_id then user_b else user_a end into v_recipient;

  select notif_new_messages into v_wants from public.user_settings where user_id = v_recipient;
  if coalesce(v_wants, true) then
    insert into public.notifications (user_id, type, actor_id, target_type, target_id, preview)
    values (
      v_recipient, 'new_message', new.sender_id, 'conversation', new.conversation_id,
      coalesce(left(new.body, 80), 'Shared a listing')
    );
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- on_comment_insert — notify the thread author of a reply (NT-2), gated by
-- notif_thread_replies. No self-notification.
-- ----------------------------------------------------------------------------
create or replace function public.on_comment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_author uuid;
  v_title  text;
  v_wants  boolean;
begin
  select author_id, title into v_author, v_title from public.threads where id = new.thread_id;
  if v_author is null or v_author = new.author_id then
    return new;  -- author commented on their own thread → no notification
  end if;

  select notif_thread_replies into v_wants from public.user_settings where user_id = v_author;
  if coalesce(v_wants, true) then
    insert into public.notifications (user_id, type, actor_id, target_type, target_id, preview)
    values (v_author, 'thread_reply', new.author_id, 'thread', new.thread_id,
            'New reply on "' || left(coalesce(v_title, ''), 60) || '"');
  end if;
  return new;
end;
$$;

create trigger trg_comment_notify
  after insert on public.comments
  for each row execute function public.on_comment_insert();

-- ----------------------------------------------------------------------------
-- mark_all_notifications_read — "Mark all read" (20).
-- ----------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.notifications enable row level security;

-- recipient-only: read your notifications and mark them read. Inserts come from
-- security-definer triggers (and the service role), never from clients.
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant execute on function public.mark_all_notifications_read() to authenticated;
