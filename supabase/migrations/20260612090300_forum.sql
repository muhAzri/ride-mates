-- ============================================================================
-- RideMates — 04 · Community forum (threads, comments, upvotes, bookmarks)
-- Source: FSD §5.3 (CF-1..5); API_CONTRACT.md §8, §9, §17.3, §17.4
-- ----------------------------------------------------------------------------
-- upvote_count / comment_count are denormalized columns kept correct by
-- triggers so the forum list (09) is cheap to render. Bookmarks (design R3)
-- feed Saved › Threads (14).
-- ============================================================================

create table public.threads (
  id            uuid primary key default extensions.gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 160),
  body          text not null check (char_length(body) <= 8000),
  category      public.thread_category,                     -- optional (CF-1)
  upvote_count  int not null default 0,
  comment_count int not null default 0,
  removed_at    timestamptz,                                -- moderation (MD-4)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index threads_category_idx on public.threads (category);
create index threads_created_idx  on public.threads (created_at desc);
create index threads_top_idx      on public.threads (upvote_count desc);

create trigger trg_threads_updated_at
  before update on public.threads
  for each row execute function public.set_updated_at();

create table public.comments (
  id         uuid primary key default extensions.gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 4000),
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

create index comments_thread_idx on public.comments (thread_id, created_at);

-- One upvote per user per thread (CF-3).
create table public.thread_upvotes (
  thread_id  uuid not null references public.threads (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- Bookmarks → Saved › Threads (14). Design R3.
create table public.thread_bookmarks (
  thread_id  uuid not null references public.threads (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Count-maintenance triggers (keep denormalized counters honest).
-- ----------------------------------------------------------------------------
create or replace function public.bump_thread_upvote_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.threads set upvote_count = upvote_count + 1 where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.threads set upvote_count = greatest(0, upvote_count - 1) where id = old.thread_id;
  end if;
  return null;
end;
$$;

create trigger trg_thread_upvote_count
  after insert or delete on public.thread_upvotes
  for each row execute function public.bump_thread_upvote_count();

create or replace function public.bump_thread_comment_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.threads set comment_count = comment_count + 1 where id = new.thread_id;
  elsif tg_op = 'DELETE' then
    update public.threads set comment_count = greatest(0, comment_count - 1) where id = old.thread_id;
  end if;
  return null;
end;
$$;

create trigger trg_thread_comment_count
  after insert or delete on public.comments
  for each row execute function public.bump_thread_comment_count();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.threads          enable row level security;
alter table public.comments         enable row level security;
alter table public.thread_upvotes   enable row level security;
alter table public.thread_bookmarks enable row level security;

-- threads: visible unless removed (admins see all). Authored content is owner-bound.
create policy threads_select
  on public.threads for select to authenticated
  using (removed_at is null or author_id = auth.uid() or public.is_admin());

create policy threads_insert_own
  on public.threads for insert to authenticated
  with check (author_id = auth.uid());

create policy threads_update_own
  on public.threads for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy threads_delete_own
  on public.threads for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- comments: same visibility model.
create policy comments_select
  on public.comments for select to authenticated
  using (removed_at is null or author_id = auth.uid() or public.is_admin());

create policy comments_insert_own
  on public.comments for insert to authenticated
  with check (author_id = auth.uid());

create policy comments_delete_own
  on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- upvotes & bookmarks: a user manages only their own.
create policy thread_upvotes_rw_own
  on public.thread_upvotes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy thread_bookmarks_rw_own
  on public.thread_bookmarks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
