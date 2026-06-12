-- ============================================================================
-- RideMates — 06b · Push device tokens (FCM/APNs)
-- Source: API_CONTRACT.md §11, R15; FSD §5.6 NT-3 (push — promoted to MVP).
-- ----------------------------------------------------------------------------
-- The in-app `notifications` feed (migration …090600) is the *history*. OS push
-- additionally reaches a user when the app is backgrounded, and push targets a
-- device's registration token — so each device registers its token here first
-- (`POST /me/devices`). The DB stores tokens only; the actual sender/worker that
-- calls FCM/APNs on the NT-1/NT-2 fan-out is a follow-up.
-- ============================================================================

create type public.device_platform as enum ('android', 'ios', 'web');   -- §11 platform

-- ----------------------------------------------------------------------------
-- device_tokens — one row per registered device token, owned by a user. The
-- token is globally unique (a physical device has one FCM/APNs token): if the
-- device changes hands (logout → another login), re-registering re-assigns the
-- token to the new owner so push follows whoever is signed in.
-- ----------------------------------------------------------------------------
create table public.device_tokens (
  id         uuid primary key default extensions.gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique check (char_length(token) between 1 and 4096),
  platform   public.device_platform not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id);

create trigger trg_device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- register_device_token — upsert the caller's device token (NT-3). SECURITY
-- DEFINER so a conflict on a token currently owned by *another* user can be
-- re-assigned to the caller (RLS UPDATE would otherwise block touching a row the
-- caller doesn't own). Always stamps `user_id = auth.uid()` — a caller can never
-- register a token under someone else's id.
-- ----------------------------------------------------------------------------
create or replace function public.register_device_token(
  p_token    text,
  p_platform public.device_platform
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (token) do update
    set user_id    = v_uid,
        platform   = excluded.platform,
        updated_at = now();
end;
$$;

-- ============================================================================
-- Row Level Security — owner-only. Writes go through the SECURITY DEFINER RPC
-- (which enforces ownership); clients may read/delete only their own tokens.
-- ============================================================================
alter table public.device_tokens enable row level security;

create policy device_tokens_select_own
  on public.device_tokens for select to authenticated
  using (user_id = auth.uid());

create policy device_tokens_delete_own
  on public.device_tokens for delete to authenticated
  using (user_id = auth.uid());

grant execute on function public.register_device_token(text, public.device_platform) to authenticated;
