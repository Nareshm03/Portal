-- Portal phone verification | Supabase PostgreSQL
-- Forward-only additive migration. Run AFTER 202611050002_messaging_uploads.sql.
-- Adds phone_verified flag to profiles so OTP delivery can be gated on verified numbers.
-- Apply in the Supabase SQL Editor. Service-role credentials must never reach the browser.

alter table public.profiles
  add column if not exists phone_verified boolean not null default false;

comment on column public.profiles.phone_verified is 'True only after the buyer has verified ownership of phone_e164 via a completed OTP handover or equivalent flow.';

-- Backfill: existing unverified numbers remain false; only ACTIVE buyers with a number are candidates.
-- No data migration needed: default false is correct until a verification flow completes.
