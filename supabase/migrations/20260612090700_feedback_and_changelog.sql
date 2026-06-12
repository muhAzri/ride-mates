-- ============================================================================
-- RideMates — 08 · Feedback, feature requests, changelog
-- Source: FSD §12 (FB-2 send feedback, FB-3 feature board, §12.5 close-the-loop)
--         API_CONTRACT.md §13, §14 (What's new)
-- ----------------------------------------------------------------------------
-- "Report a bug" was merged into one Send-feedback form (design R4) with a
-- Type chip (bug/idea/other). Feature requests are a public, votable board.
-- Changelog backs Settings → "What's new".
-- ============================================================================

create table public.feedback (
  id              uuid primary key default extensions.gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  type            public.feedback_type not null,                -- bug | idea | other (17)
  message         text not null check (char_length(message) between 1 and 4000),
  screenshot_url  text,                                         -- URL only (stored in S3)
  include_app_info boolean not null default false,
  app_version     text,
  platform        text,
  os_version      text,
  device_model    text,
  status          text not null default 'received',            -- received | triaged | closed
  created_at      timestamptz not null default now()
);

create index feedback_user_idx on public.feedback (user_id, created_at desc);

create table public.feature_requests (
  id          uuid primary key default extensions.gen_random_uuid(),
  author_id   uuid references public.profiles (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  status      public.feature_request_status not null default 'open',  -- §12.5 statuses
  vote_count  int not null default 0,
  created_at  timestamptz not null default now()
);

create index feature_requests_votes_idx  on public.feature_requests (vote_count desc);
create index feature_requests_status_idx on public.feature_requests (status, created_at desc);

create table public.feature_request_votes (
  request_id uuid not null references public.feature_requests (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table public.changelog_entries (
  id          uuid primary key default extensions.gen_random_uuid(),
  version     text not null,                                   -- e.g. "1.2" (16 "What's new")
  released_on date not null,
  title       text not null,
  items       text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index changelog_released_idx on public.changelog_entries (released_on desc);

-- ----------------------------------------------------------------------------
-- Vote count maintenance (FB-3 — one vote per user).
-- ----------------------------------------------------------------------------
create or replace function public.bump_feature_vote_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.feature_requests set vote_count = vote_count + 1 where id = new.request_id;
  elsif tg_op = 'DELETE' then
    update public.feature_requests set vote_count = greatest(0, vote_count - 1) where id = old.request_id;
  end if;
  return null;
end;
$$;

create trigger trg_feature_vote_count
  after insert or delete on public.feature_request_votes
  for each row execute function public.bump_feature_vote_count();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.feedback              enable row level security;
alter table public.feature_requests      enable row level security;
alter table public.feature_request_votes enable row level security;
alter table public.changelog_entries     enable row level security;

-- feedback: file your own; read your own; admins read all.
create policy feedback_insert_self
  on public.feedback for insert to authenticated
  with check (user_id = auth.uid());

create policy feedback_select_own_or_admin
  on public.feedback for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- feature_requests: everyone reads; anyone proposes (as themselves); only
-- admins change status (vote_count is trigger-managed).
create policy feature_requests_select_all
  on public.feature_requests for select to authenticated
  using (true);

create policy feature_requests_insert_self
  on public.feature_requests for insert to authenticated
  with check (author_id = auth.uid());

create policy feature_requests_update_admin
  on public.feature_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- votes: a user manages their own vote.
create policy feature_request_votes_rw_own
  on public.feature_request_votes for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- changelog: everyone reads; only admins write.
create policy changelog_select_all
  on public.changelog_entries for select to authenticated
  using (true);

create policy changelog_write_admin
  on public.changelog_entries for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
