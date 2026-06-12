-- ============================================================================
-- RideMates — 05 · Messaging (1:1 conversations, messages, share-a-listing)
-- Source: FSD §5.4 (MS-1..4), MP-6; API_CONTRACT.md §10, §17.5, §17.6
-- ----------------------------------------------------------------------------
-- Conversations are strictly 1:1 (MS-1). We store the pair as ordered
-- (user_a < user_b) with a unique constraint so "contact seller" is idempotent
-- per pair (MP-6). Blocking (MD-5) is enforced on send. Messages carry text
-- and/or a shared listing reference (MS-3); no media in MVP (MS-5 = Growth).
-- ============================================================================

create table public.conversations (
  id              uuid primary key default extensions.gen_random_uuid(),
  user_a          uuid not null references public.profiles (id) on delete cascade,
  user_b          uuid not null references public.profiles (id) on delete cascade,
  listing_ref     uuid references public.listings (id) on delete set null,  -- MP-6 pre-link
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint conversations_pair_ordered check (user_a < user_b),
  constraint conversations_pair_unique  unique (user_a, user_b)
);

create index conversations_user_a_idx on public.conversations (user_a, last_message_at desc);
create index conversations_user_b_idx on public.conversations (user_b, last_message_at desc);

-- Per-participant read marker → drives unread indicators (MS-4).
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id              uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text check (char_length(body) <= 4000),
  listing_ref     uuid references public.listings (id) on delete set null,  -- MS-3 share a listing
  created_at      timestamptz not null default now(),
  constraint messages_has_content check (body is not null or listing_ref is not null)
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ----------------------------------------------------------------------------
-- is_conversation_participant — helper for RLS readability.
-- ----------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation uuid, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation and (c.user_a = p_user or c.user_b = p_user)
  );
$$;

-- ----------------------------------------------------------------------------
-- is_blocked_between — true if either user blocked the other (MD-5). Written in
-- plpgsql so it can forward-reference public.blocks (created in migration 06);
-- plpgsql resolves table names at call time rather than at creation.
-- ----------------------------------------------------------------------------
create or replace function public.is_blocked_between(p_user1 uuid, p_user2 uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_user1 and b.blocked_id = p_user2)
       or (b.blocker_id = p_user2 and b.blocked_id = p_user1)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- get_or_create_conversation — MP-6 / MS-1. Idempotent per pair; refuses if
-- the two users have blocked each other (MD-5).
-- ----------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(
  p_other_user uuid,
  p_listing_ref uuid default null
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_conv public.conversations;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_other_user = v_uid then raise exception 'Cannot message yourself'; end if;
  if public.is_blocked_between(v_uid, p_other_user) then
    raise exception 'Conversation not allowed (blocked)';
  end if;

  v_a := least(v_uid, p_other_user);
  v_b := greatest(v_uid, p_other_user);

  insert into public.conversations (user_a, user_b, listing_ref)
  values (v_a, v_b, p_listing_ref)
  on conflict (user_a, user_b) do update
    set listing_ref = coalesce(conversations.listing_ref, excluded.listing_ref)
  returning * into v_conv;

  -- Ensure read markers exist for both participants.
  insert into public.conversation_reads (conversation_id, user_id)
  values (v_conv.id, v_a), (v_conv.id, v_b)
  on conflict do nothing;

  return v_conv;
end;
$$;

-- ----------------------------------------------------------------------------
-- on_message_insert — bump last_message_at. (Notification fan-out is added in
-- migration 07 once the notifications table exists.)
-- ----------------------------------------------------------------------------
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger trg_message_after_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ----------------------------------------------------------------------------
-- my_conversations — conversation list with unread counts (MS-4).
-- ----------------------------------------------------------------------------
create or replace function public.my_conversations(p_limit int default 20, p_offset int default 0)
returns table (
  id                  uuid,
  other_user_id       uuid,
  listing_ref         uuid,
  last_message_at     timestamptz,
  last_message_preview text,
  unread_count        int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end as other_user_id,
    c.listing_ref,
    c.last_message_at,
    (select m.body from public.messages m
      where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message_preview,
    (select count(*)::int from public.messages m
      left join public.conversation_reads r
        on r.conversation_id = c.id and r.user_id = auth.uid()
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)) as unread_count
  from public.conversations c
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by c.last_message_at desc nulls last
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
$$;

-- ----------------------------------------------------------------------------
-- mark_conversation_read — POST /conversations/{id}/read (MS-4).
-- ----------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_participant(p_conversation, auth.uid()) then
    raise exception 'Not a participant';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation, auth.uid(), now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.conversations      enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.messages           enable row level security;

-- conversations: only the two participants (or admin) can read. Creation goes
-- through get_or_create_conversation(); direct insert is allowed only for self-pairs.
create policy conversations_select_participant
  on public.conversations for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_admin());

create policy conversations_insert_self
  on public.conversations for insert to authenticated
  with check (user_a = auth.uid() or user_b = auth.uid());

-- conversation_reads: each participant manages their own marker.
create policy conversation_reads_rw_own
  on public.conversation_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages: readable by participants; sendable by a participant who is the
-- sender and is not blocked by the other party (MD-5).
create policy messages_select_participant
  on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id, auth.uid()) or public.is_admin());

create policy messages_insert_participant
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id, auth.uid())
    and not exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and public.is_blocked_between(
              c.user_a,
              c.user_b)
    )
  );

grant execute on function public.get_or_create_conversation(uuid, uuid) to authenticated;
grant execute on function public.my_conversations(int, int) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
