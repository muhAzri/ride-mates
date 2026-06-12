-- ============================================================================
-- RideMates — 03b · Marketplace write/detail/saved RPCs
-- Source: API_CONTRACT.md §6 (listings), §7 (saved), §17.2; FSD MP-1..8, LP-1..5.
-- ----------------------------------------------------------------------------
-- The base marketplace migration (…090200) created `listings`, `listing_photos`,
-- `listing_locations`, `saved_listings`, `haversine_km()` and `nearby_listings()`.
-- This additive migration adds what the listing *write* and *detail* paths need:
--
--   * `create_listing()`     — insert a listing + its photos atomically (MP-1).
--                              Photo files are uploaded inline by the route handler
--                              (multipart, R12); their URLs are passed here as a
--                              JSON array (1–3). SECURITY DEFINER so one round-trip
--                              can't leave a photoless listing.
--   * `listing_detail()`     — single-listing read with server-computed distance
--                              (LP-3), photos, seller mini, and the viewer's
--                              saved-state — never coordinates (LP-1/2). Powers
--                              `GET /listings/{id}` (06).
--   * `saved_listings_feed()`— the caller's wishlist as ListingCards with distance
--                              (`GET /me/saved/listings`, 14). Sold items remain
--                              visible (Heart kept); removed items drop out.
--
-- Listing edits reconcile photos with plain owner-scoped statements (RLS-guarded),
-- so no update RPC is required.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- create_listing — insert a listing and its photos atomically (MP-1). Photos are
-- passed as a JSON array `[{ "url": "…", "width": 1280, "height": 960 }]` (1–3),
-- already stored in S3 by the handler. The AFTER INSERT trigger
-- `inherit_listing_location` stamps the area label + precise pin from the owner's
-- profile (FSD §7.2). Returns the new listing id; the caller reads it back via
-- `listing_detail`.
-- ----------------------------------------------------------------------------
create or replace function public.create_listing(
  p_title       text,
  p_description text,
  p_price_idr   bigint,
  p_category    public.listing_category,
  p_condition   public.listing_condition,
  p_photos      jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_listing_id uuid;
  v_count      int  := jsonb_array_length(coalesce(p_photos, '[]'::jsonb));
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if v_count < 1 or v_count > 3 then
    raise exception 'a listing must have 1 to 3 photos' using errcode = '23514';
  end if;

  insert into public.listings (owner_id, title, description, price_idr, category, condition)
  values (v_uid, p_title, p_description, p_price_idr, p_category, p_condition)
  returning id into v_listing_id;   -- trigger inherits the owner's pin + area

  insert into public.listing_photos (listing_id, url, width, height, position)
  select v_listing_id,
         elem->>'url',
         nullif(elem->>'width', '')::int,
         nullif(elem->>'height', '')::int,
         (ord - 1)::int
  from jsonb_array_elements(p_photos) with ordinality as t(elem, ord);

  return v_listing_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- listing_detail — one listing with server-computed distance (LP-3), its photos,
-- the seller mini-card, and whether the viewer saved it. SECURITY DEFINER so it
-- can read the owner-only `listing_locations` to compute distance and surface a
-- listing of any status to the boundary, which decides 200/404/410 visibility
-- (active/sold → anyone; inactive/removed → owner or admin only). Coordinates are
-- never returned — only `distance_km` + `display_area` (LP-1/2).
-- ----------------------------------------------------------------------------
create or replace function public.listing_detail(p_id uuid)
returns table (
  id                 uuid,
  owner_id           uuid,
  title              text,
  description        text,
  price_idr          bigint,
  category           public.listing_category,
  condition          public.listing_condition,
  status             public.listing_status,
  display_area       text,
  removed_at         timestamptz,
  distance_km        double precision,
  is_saved_by_me     boolean,
  photos             json,
  created_at         timestamptz,
  seller_id          uuid,
  seller_display_name text,
  seller_avatar_url  text,
  seller_cycling_type public.cycling_type,
  seller_rating_average numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lat, lng from public.user_locations where user_id = auth.uid()
  )
  select
    l.id, l.owner_id, l.title, l.description, l.price_idr, l.category, l.condition,
    l.status, l.display_area, l.removed_at,
    case when me.lat is not null and ll.lat is not null
         then round(public.haversine_km(me.lat, me.lng, ll.lat, ll.lng)::numeric, 1)::double precision
    end as distance_km,
    exists (
      select 1 from public.saved_listings s
      where s.listing_id = l.id and s.user_id = auth.uid()
    ) as is_saved_by_me,
    coalesce(
      (select json_agg(
                json_build_object('id', lp.id, 'url', lp.url, 'width', lp.width, 'height', lp.height)
                order by lp.position, lp.created_at)
       from public.listing_photos lp where lp.listing_id = l.id),
      '[]'::json
    ) as photos,
    l.created_at,
    p.id, p.display_name, p.avatar_url, p.cycling_type, p.rating_average
  from public.listings l
  left join public.listing_locations ll on ll.listing_id = l.id
  left join me on true
  join public.profiles p on p.id = l.owner_id
  where l.id = p_id;
$$;

-- ----------------------------------------------------------------------------
-- saved_listings_feed — the caller's wishlist as ListingCards (14 Saved). Sold
-- items stay (the Heart persists across a sale); removed items drop out. Distance
-- is server-computed (LP-3); `total_count` backs the "Listings · N" header.
-- ----------------------------------------------------------------------------
create or replace function public.saved_listings_feed(
  p_limit  int default 20,
  p_offset int default 0
)
returns table (
  id              uuid,
  owner_id        uuid,
  title           text,
  price_idr       bigint,
  category        public.listing_category,
  condition       public.listing_condition,
  status          public.listing_status,
  display_area    text,
  distance_km     double precision,
  first_photo_url text,
  created_at      timestamptz,
  saved_at        timestamptz,
  total_count     bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select lat, lng from public.user_locations where user_id = auth.uid()
  ),
  saved as (
    select l.id, l.owner_id, l.title, l.price_idr, l.category, l.condition, l.status,
           l.display_area, l.created_at, s.created_at as saved_at,
           case when me.lat is not null and ll.lat is not null
                then round(public.haversine_km(me.lat, me.lng, ll.lat, ll.lng)::numeric, 1)::double precision
           end as distance_km,
           (select lp.url from public.listing_photos lp
             where lp.listing_id = l.id order by lp.position, lp.created_at limit 1) as first_photo_url
    from public.saved_listings s
    join public.listings l on l.id = s.listing_id
    left join public.listing_locations ll on ll.listing_id = l.id
    left join me on true
    where s.user_id = auth.uid()
      and l.removed_at is null
  )
  select id, owner_id, title, price_idr, category, condition, status, display_area,
         distance_km, first_photo_url, created_at, saved_at,
         count(*) over () as total_count
  from saved
  order by saved_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function public.create_listing(
  text, text, bigint, public.listing_category, public.listing_condition, jsonb) to authenticated;
grant execute on function public.listing_detail(uuid) to authenticated;
grant execute on function public.saved_listings_feed(int, int) to authenticated;
