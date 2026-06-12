-- ============================================================================
-- RideMates — 01 · Extensions, enums, and generic helpers
-- Source: RideMates_FSD.docx v0.4 §6 (Data Model), API_CONTRACT.md §17 (Schemas)
-- ----------------------------------------------------------------------------
-- This migration establishes shared building blocks used by every later
-- migration: required extensions, the project's enum types, and the generic
-- `set_updated_at()` trigger function.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid()
create extension if not exists citext   with schema extensions;   -- case-insensitive text

-- ----------------------------------------------------------------------------
-- Enum types — single source of truth for the contract's documented enums.
-- (See API_CONTRACT.md; values mirror the design screens and FSD copy.)
-- ----------------------------------------------------------------------------

-- UA-3 / Users
create type public.user_role         as enum ('user', 'admin');                                    -- §3, R/role
create type public.cycling_type      as enum ('road', 'mtb', 'gravel', 'folding', 'casual');       -- 03 Profile setup
create type public.contact_preference as enum ('in_app_chat');                                      -- MVP default; FSD UA-3

-- MP / Marketplace
create type public.listing_category  as enum ('bike', 'groupset', 'wheels', 'apparel', 'accessory', 'other'); -- 08 / §6
create type public.listing_condition as enum ('new', 'like_new', 'good', 'used');                  -- 06/08
create type public.listing_status    as enum ('active', 'sold', 'inactive');                       -- MP-8

-- CF / Forum
create type public.thread_category   as enum ('rides', 'tech', 'gear', 'general');                 -- 09 chips

-- MD / Moderation
create type public.report_target_type as enum ('user', 'listing', 'thread', 'comment');            -- MD-1/2/3 (polymorphic)
create type public.report_reason      as enum ('spam', 'scam_or_fraud', 'prohibited_item',
                                               'harassment', 'inappropriate', 'something_else');     -- 15 Report sheet
create type public.report_status      as enum ('queued', 'resolved', 'dismissed');                 -- MD-4
create type public.report_action      as enum ('remove_content', 'dismiss', 'warn_user');          -- MD-4 resolve

-- NT / Notifications
create type public.notification_type  as enum ('new_message', 'thread_reply', 'thread_upvote', 'system'); -- 20

-- FB / Feedback (§12)
create type public.feedback_type          as enum ('bug', 'idea', 'other');                        -- 17 Type chips
create type public.feature_request_status as enum ('open', 'planned', 'in_progress', 'shipped');   -- §12.5

-- ----------------------------------------------------------------------------
-- Generic updated-at trigger. search_path is pinned empty for safety.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
