-- ============================================================================
-- RideMates — 06 · Moderation & safety (reports, blocks, admin queue)
-- Source: FSD §5.5 (MD-1..5), FB-1; API_CONTRACT.md §12, §15, §17.8
-- ----------------------------------------------------------------------------
-- Reactive, report-based moderation. Reports are polymorphic (user/listing/
-- thread/comment). Reporters can file and read their own; admins (profiles.role
-- = 'admin') read the queue and resolve. Resolving with 'remove_content' soft-
-- removes the target via removed_at (listings.removed_at, threads/comments).
-- ============================================================================

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create table public.reports (
  id                uuid primary key default extensions.gen_random_uuid(),
  reporter_id       uuid not null references public.profiles (id) on delete cascade,
  target_type       public.report_target_type not null,
  target_id         uuid not null,
  reason            public.report_reason not null,
  details           text check (char_length(details) <= 2000),
  status            public.report_status not null default 'queued',
  resolution_action public.report_action,
  resolution_note   text,
  resolved_by       uuid references public.profiles (id),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),
  -- "Something else" requires a free-text description (15 Report sheet fix).
  constraint reports_something_else_needs_details
    check (reason <> 'something_else' or (details is not null and char_length(btrim(details)) > 0))
);

create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

-- ----------------------------------------------------------------------------
-- resolve_report — admin action (MD-4). Applies the chosen action and stamps
-- the audit fields. 'remove_content' soft-removes the reported target.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_report(
  p_report_id uuid,
  p_action    public.report_action,
  p_note      text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
  v_status public.report_status;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Admin only';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then raise exception 'Report not found'; end if;

  if p_action = 'remove_content' then
    if v_report.target_type = 'listing' then
      update public.listings set removed_at = now() where id = v_report.target_id;
    elsif v_report.target_type = 'thread' then
      update public.threads set removed_at = now() where id = v_report.target_id;
    elsif v_report.target_type = 'comment' then
      update public.comments set removed_at = now() where id = v_report.target_id;
    end if;
    v_status := 'resolved';
  elsif p_action = 'warn_user' then
    v_status := 'resolved';
  else  -- dismiss
    v_status := 'dismissed';
  end if;

  update public.reports
     set status = v_status,
         resolution_action = p_action,
         resolution_note = p_note,
         resolved_by = auth.uid(),
         resolved_at = now()
   where id = p_report_id
   returning * into v_report;

  return v_report;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.blocks  enable row level security;
alter table public.reports enable row level security;

-- blocks: a user manages their own block list (MD-5 / Settings 16).
create policy blocks_rw_own
  on public.blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- reports: anyone can file (as themselves); reporters see their own; admins see all.
create policy reports_insert_self
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_select_own_or_admin
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

-- Only admins mutate report state, and only through resolve_report() in
-- practice; direct UPDATE is restricted to admins as a backstop.
create policy reports_update_admin
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant execute on function public.resolve_report(uuid, public.report_action, text) to authenticated;
