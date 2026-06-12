# RideMates — Supabase schema & migrations

Database + auth layer for the RideMates MVP. Implements the data model in
`RideMates_FSD.docx` v0.4 §6 and the schemas/endpoints in
[`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md). Auth (email/password +
Google OAuth) is handled by **Supabase Auth**; everything else lives in these
migrations.

## Migration order

| File | Contents | FSD / API |
|------|----------|-----------|
| `…090000_init_extensions_and_enums.sql` | Extensions, all enum types, `set_updated_at()` | §17 enums |
| `…090100_profiles_and_auth.sql` | `profiles` (+`role`), `user_settings`, `user_locations`, `is_admin()`, signup trigger, role guard, `set_my_location()` | UA-1..6, §5, §14, LP-1 |
| `…090200_marketplace.sql` | `listings`, `listing_photos`, `listing_locations`, `saved_listings`, `nearby_listings()` | MP-1..12, §6, §7 |
| `…090300_forum.sql` | `threads`, `comments`, `thread_upvotes`, `thread_bookmarks` | CF-1..5, §8, §9 |
| `…090400_messaging.sql` | `conversations`, `messages`, `conversation_reads`, `get_or_create_conversation()`, `my_conversations()` | MS-1..4, MP-6, §10 |
| `…090500_moderation.sql` | `reports`, `blocks`, `resolve_report()` | MD-1..5, §12, §15 |
| `…090600_notifications.sql` | `notifications`, fan-out triggers (message/reply) | NT-1, NT-2, §11 |
| `…090700_feedback_and_changelog.sql` | `feedback`, `feature_requests`, `feature_request_votes`, `changelog_entries` | FB-2, FB-3, §13 |

Files are timestamp-ordered; apply them in filename order.

## How to apply

```bash
# from ride-mates/
supabase init           # once, if supabase/config.toml does not exist yet
supabase start          # local stack (Postgres + Auth + Studio)
supabase db reset       # applies every migration from scratch — use to validate
# against a hosted project:
supabase link --project-ref <ref>
supabase db push
```

Enable the **Google** provider in Auth settings (UA-6) — the signup trigger
reads `full_name` / `name` / `avatar_url` from the OAuth metadata.

## Roles & the admin page

`auth.users` has no application role, so every user is mirrored into
`public.profiles` with a `role` enum (`user` | `admin`). The admin
moderation page (FSD MD-4) is gated by `public.is_admin()`, used throughout RLS
and inside `resolve_report()`.

- Users **cannot** escalate themselves: `enforce_profile_guard()` (a
  `BEFORE UPDATE` trigger) rejects any `role` change unless the caller is
  already an admin, and ignores client attempts to set `rating_average`.
- **Promote the first admin manually** (e.g. in Supabase Studio SQL editor,
  which runs as a privileged role and bypasses the guard):

  ```sql
  update public.profiles set role = 'admin'
  where id = (select id from auth.users where email = 'you@example.com');
  ```

> Design choice: a `role` column on `profiles` (rather than a separate
> `admins` table) because the API contract already exposes `user.role`, and one
> column keeps authorization checks to a single `is_admin()` lookup. A separate
> table would work too — switch `is_admin()` to query it if you prefer.

## Location privacy is enforced by table layout (FSD LP-1)

Postgres RLS gates **rows**, not columns, so precise coordinates are kept in
separate **owner-only** tables that other clients can never `SELECT`:

- `user_locations` (a user's pin) and `listing_locations` (a listing's pin) hold
  raw `lat`/`lng`. `listing_locations` has **RLS enabled with no policies** — no
  client can read it at all.
- Public tables (`profiles`, `listings`) carry only `display_area` (kecamatan).
- Distance is produced **only** by `SECURITY DEFINER` functions
  (`nearby_listings()`, `haversine_km()`) that compute it server-side and return
  `distance_km` + `display_area` — never coordinates. This satisfies LP-1…LP-3
  structurally, not just by convention.
- A listing inherits the seller's pin at creation via the
  `inherit_listing_location()` trigger (FSD §7.2).

## Photos / media

The DB stores **URLs only** — files live in an external S3-compatible bucket.
`listing_photos.url`, `profiles.avatar_url`, and `feedback.screenshot_url` are
plain strings written after the client uploads (`POST /uploads` in the
contract). `width`/`height` on photos are optional layout hints. No Supabase
Storage buckets are required by these migrations.

## RLS summary

Every table has RLS enabled. The recurring patterns:

- **Owner-only** (`user_settings`, `user_locations`, `saved_listings`,
  `thread_*` votes/bookmarks, `blocks`, `conversation_reads`): `user_id = auth.uid()`.
- **Public-read, owner-write** (`profiles`, `listings`, `threads`, `comments`,
  `listing_photos`, `feature_requests`, `changelog_entries`): authenticated read
  (minus removed/inactive content), writes restricted to the owner.
- **Participant-only** (`conversations`, `messages`): only the two participants;
  sends are additionally blocked between blocked users (MD-5).
- **Admin** (`reports` queue, `feature_requests` status, `changelog` writes):
  gated by `is_admin()`.
- **Server-generated** (`notifications`): recipient reads/marks-read; rows are
  inserted only by security-definer triggers, never by clients.

## RPCs (call via `supabase.rpc(...)`)

| Function | Purpose | Contract |
|----------|---------|----------|
| `set_my_location(lat, lng, display_area, area_level)` | Set/move pin; stores precise coords server-side | `PUT /users/me/location` |
| `nearby_listings(q, category, condition, min, max, radius_km, explore_beyond, sort, status, limit, offset)` | Browse/search with proximity | `GET /listings` |
| `get_or_create_conversation(other_user, listing_ref)` | Idempotent 1:1 conversation | `POST /conversations` |
| `my_conversations(limit, offset)` | Conversation list + unread counts | `GET /conversations` |
| `mark_conversation_read(conversation_id)` | Clear unread | `POST /conversations/{id}/read` |
| `mark_all_notifications_read()` | "Mark all read" | `POST /notifications/read-all` |
| `resolve_report(report_id, action, note)` | Admin moderation action | `POST /admin/reports/{id}/resolve` |

## Notes / open items (mirror API_CONTRACT.md §16)

- `profiles.rating_average` is present and **read-only** (no write path) pending
  the product decision on ratings (contract Open Question **O1**). It is *not*
  computed by any trigger yet — wire it up once the rating source is decided.
- `nearby_listings()` uses haversine (no PostGIS). For Growth-scale radius
  queries, add PostGIS + a GiST index on a `geography` column.
- Realtime delivery (MS-2/NT-1) rides on Supabase Realtime over `messages` /
  `notifications`; the REST/RPC layer above is the source of truth.
