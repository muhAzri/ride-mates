-- ============================================================================
-- RideMates — 03 · Marketplace (listings, photos, location, saved/wishlist)
-- Source: FSD §5.2 (MP-1..12), LP-1..5; API_CONTRACT.md §6, §7, §17.2
-- ----------------------------------------------------------------------------
-- A listing inherits the seller's pinned location at creation (FSD §7.2). The
-- precise coordinates live in `listing_locations` (no client SELECT, ever);
-- the public `listings` row carries only the area label. Distance is produced
-- by the SECURITY DEFINER function `nearby_listings()` (MP-4/10/11, LP-2/3).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- haversine_km — great-circle distance, server-side (LP-3). Lightweight; no
-- PostGIS dependency. (For Growth-scale radius queries, swap to PostGIS + GiST.)
-- ----------------------------------------------------------------------------
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ----------------------------------------------------------------------------
-- listings — public marketplace record (MP-1). No coordinates here (LP-2).
-- ----------------------------------------------------------------------------
create table public.listings (
  id           uuid primary key default extensions.gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 4000),
  price_idr    bigint not null check (price_idr >= 0),       -- whole rupiah, no minor unit
  category     public.listing_category not null,
  condition    public.listing_condition not null,
  status       public.listing_status not null default 'active',  -- MP-8
  display_area text,                                          -- inherited from owner pin (MP-12)
  removed_at   timestamptz,                                   -- set by moderation (MD-4); hides from feed
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index listings_owner_idx   on public.listings (owner_id);
create index listings_status_idx  on public.listings (status) where removed_at is null;
create index listings_category_idx on public.listings (category);
create index listings_created_idx  on public.listings (created_at desc);

create trigger trg_listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- listing_locations — precise coords, owner-only at write, NO client read.
-- ----------------------------------------------------------------------------
create table public.listing_locations (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180)
);

-- ----------------------------------------------------------------------------
-- listing_photos — ordered photos (MP-1; uploads handled by storage/§4.3).
-- ----------------------------------------------------------------------------
create table public.listing_photos (
  id         uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url        text not null,
  width      int,
  height     int,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index listing_photos_listing_idx on public.listing_photos (listing_id, position);

-- ----------------------------------------------------------------------------
-- saved_listings — wishlist (Heart on 06, 07 → 14 Saved › Listings). Design R2.
-- ----------------------------------------------------------------------------
create table public.saved_listings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ----------------------------------------------------------------------------
-- inherit_listing_location() — on listing insert, copy the owner's current pin
-- into listing_locations and stamp the public area label (FSD §7.2). Security
-- definer so it can read owner-only user_locations and write the no-read table.
-- ----------------------------------------------------------------------------
create or replace function public.inherit_listing_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loc public.user_locations;
  v_area text;
begin
  select * into v_loc from public.user_locations where user_id = new.owner_id;
  if v_loc.user_id is not null then
    insert into public.listing_locations (listing_id, lat, lng)
    values (new.id, v_loc.lat, v_loc.lng)
    on conflict (listing_id) do update set lat = excluded.lat, lng = excluded.lng;
  end if;

  if new.display_area is null then
    select display_area into v_area from public.profiles where id = new.owner_id;
    update public.listings set display_area = v_area where id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_listings_inherit_location
  after insert on public.listings
  for each row execute function public.inherit_listing_location();

-- ----------------------------------------------------------------------------
-- nearby_listings() — browse / search / filter with proximity (MP-4/5/10/11).
-- Returns area + server-computed distance only (LP-2/3); never coordinates.
-- When the viewer has no pin, distance is null and ordering falls back to
-- recency. `p_explore_beyond` keeps out-of-radius items (flagged) per MP-11.
-- ----------------------------------------------------------------------------
create or replace function public.nearby_listings(
  p_q             text default null,
  p_category      public.listing_category default null,
  p_condition     public.listing_condition default null,
  p_min_price_idr bigint default null,
  p_max_price_idr bigint default null,
  p_radius_km     numeric default 25,        -- null => "All"
  p_explore_beyond boolean default false,
  p_sort          text default 'nearest',    -- 'nearest' | 'recent'
  p_status        public.listing_status default 'active',
  p_limit         int default 20,
  p_offset        int default 0
)
returns table (
  id            uuid,
  owner_id      uuid,
  title         text,
  price_idr     bigint,
  category      public.listing_category,
  condition     public.listing_condition,
  status        public.listing_status,
  display_area  text,
  distance_km   double precision,
  within_radius boolean,
  first_photo_url text,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lat, lng from public.user_locations where user_id = auth.uid()
  ),
  base as (
    select
      l.id, l.owner_id, l.title, l.price_idr, l.category, l.condition, l.status,
      l.display_area, l.created_at,
      case when me.lat is not null and ll.lat is not null
           then round(public.haversine_km(me.lat, me.lng, ll.lat, ll.lng)::numeric, 1)::double precision
      end as distance_km,
      (select lp.url from public.listing_photos lp
        where lp.listing_id = l.id order by lp.position, lp.created_at limit 1) as first_photo_url
    from public.listings l
    left join public.listing_locations ll on ll.listing_id = l.id
    left join me on true
    where l.removed_at is null
      and (l.status = p_status)
      and (p_q is null or l.title ilike '%' || p_q || '%' or l.description ilike '%' || p_q || '%')
      and (p_category is null or l.category = p_category)
      and (p_condition is null or l.condition = p_condition)
      and (p_min_price_idr is null or l.price_idr >= p_min_price_idr)
      and (p_max_price_idr is null or l.price_idr <= p_max_price_idr)
  ),
  flagged as (
    select *,
      (p_radius_km is null or distance_km is null or distance_km <= p_radius_km) as within_radius
    from base
  )
  select id, owner_id, title, price_idr, category, condition, status, display_area,
         distance_km, within_radius, first_photo_url, created_at
  from flagged
  where p_radius_km is null
     or within_radius
     or p_explore_beyond                       -- MP-11: keep out-of-radius, flagged
  order by
    case when p_explore_beyond then (not within_radius) end nulls first,  -- in-radius first
    case when p_sort = 'nearest' then distance_km end asc nulls last,
    created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.listings          enable row level security;
alter table public.listing_locations enable row level security;  -- intentionally NO policies
alter table public.listing_photos    enable row level security;
alter table public.saved_listings    enable row level security;

-- listings: visible if active & not removed, or you own it, or you are admin.
create policy listings_select
  on public.listings for select to authenticated
  using (
    (status = 'active' and removed_at is null)
    or owner_id = auth.uid()
    or public.is_admin()
  );

create policy listings_insert_own
  on public.listings for insert to authenticated
  with check (owner_id = auth.uid());

create policy listings_update_own
  on public.listings for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy listings_delete_own
  on public.listings for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- listing_locations: NO policy => no direct client access. Functions (security
-- definer) and the service role are the only readers/writers (LP-1).

-- listing_photos: readable when the parent listing is; writable by listing owner.
create policy listing_photos_select
  on public.listing_photos for select to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_id
      and ((l.status = 'active' and l.removed_at is null) or l.owner_id = auth.uid() or public.is_admin())
  ));

create policy listing_photos_write_own
  on public.listing_photos for all to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

-- saved_listings: strictly owner-only (your wishlist).
create policy saved_listings_rw_own
  on public.saved_listings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant execute on function public.haversine_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.nearby_listings(text, public.listing_category, public.listing_condition,
  bigint, bigint, numeric, boolean, text, public.listing_status, int, int) to authenticated;
