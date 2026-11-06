-- =============================================
-- Portal Marketplace Demo Data Seed Script
-- =============================================
--
-- EXECUTION INSTRUCTIONS:
-- 1. Run in Supabase SQL Editor with service_role privileges.
-- 2. Demo profiles MUST exist BEFORE running this script.
-- 3. Profile setup is done via bootstrap_demo.sql and admin API flows.
-- 4. Do NOT run against production databases.
--
-- SETUP REQUIREMENTS:
--   Step 1: Create three Auth users via signup:
--     - Admin: profile will be configured via bootstrap_demo.sql
--     - Buyer: will be created by auth, needs role provisioning
--     - Traveller: will be created by auth, needs role provisioning + KYC review
--
--   Step 2: After admin exists, provision roles via API:
--     POST /admin/profiles/{buyer_id}/role     {"role": "buyer"}
--     POST /admin/profiles/{traveller_id}/role {"role": "traveller"}
--
--   Step 3: Complete KYC flow via API:
--     As traveller: POST /kyc/submit
--     As admin: POST /admin/profiles/{traveller_id}/kyc-review { "decision": "VERIFIED", "providerReference": "DEMO" }
--
--   Step 4: Update this script with actual buyer and traveller IDs.
--
-- Script is idempotent: safe to run multiple times.
--
-- =============================================

-- =============================================
-- DEMO PROFILE ID PLACEHOLDERS
-- Update with actual UUIDs from your auth.users table:
-- =============================================
-- \set demo_buyer_id '<buyer-uuid-from-auth-users>'
-- \set demo_traveller_id '<traveller-uuid-from-auth-users>'
-- =============================================

-- =============================================
-- PREFLIGHT CHECK: Verify required demo profiles
-- =============================================

begin;

-- Resolve demo profiles from auth.users by email
-- These queries fail if the demo accounts don't exist
-- The profiles must have:
--   - Buyer: role='buyer', account_status='ACTIVE'
--   - Traveller: role='traveller', account_status='ACTIVE', kyc_status='VERIFIED'

with demo_buyer as (
  select p.id as buyer_id
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email = 'demo.buyer@example.com'
    and p.role = 'buyer'
    and p.account_status = 'ACTIVE'
  limit 1
),
demo_traveller as (
  select p.id as traveller_id
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email = 'demo.traveller@example.com'
    and p.role = 'traveller'
    and p.account_status = 'ACTIVE'
    and p.kyc_status = 'VERIFIED'
  limit 1
)
select
  (select string_agg('BUYER MISSING or WRONG: email=demo.buyer@example.com, role=buyer, status=ACTIVE', ',') from demo_buyer where buyer_id is null) as buyer_error,
  (select string_agg('TRAVELLER MISSING or WRONG: email=demo.traveller@example.com, role=traveller, status=ACTIVE, kyc=VERIFIED', ',') from demo_traveller where traveller_id is null) as traveller_error
into strict (v_buyer_error, v_traveller_error);

-- Fail if profiles not found with correct attributes
do $$
begin
  if v_buyer_error is not null then
    raise exception 'SEED FAILED: %', v_buyer_error;
  end if;
  if v_traveller_error is not null then
    raise exception 'SEED FAILED: %', v_traveller_error;
  end if;
end;
$$;

-- Store IDs for subsequent inserts
with demo_buyer as (
  select p.id as buyer_id
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email = 'demo.buyer@example.com'
)
select string_agg(buyer_id::text, ',') into v_demo_buyer_id from demo_buyer;

with demo_traveller as (
  select p.id as traveller_id
  from auth.users au
  join public.profiles p on p.id = au.id
  where au.email = 'demo.traveller@example.com'
)
select string_agg(traveller_id::text, ',') into v_demo_traveller_id from demo_traveller;

-- =============================================
-- CONFLICT CHECK: Verify no incompatible existing records
-- =============================================

-- Trip 1 conflict check
if exists (
  select 1 from public.trips
  where id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
    and (
      traveller_id <> v_demo_traveller_id::uuid
      or origin_country <> 'IN'
      or destination_country <> 'IN'
      or origin_airport_code <> 'DEL'
      or destination_airport_code <> 'BOM'
      or status <> 'DRAFT'
    )
) then
  raise exception 'SEED FAILED: Trip ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 exists with incompatible data';
end if;

-- Trip 2 conflict check
if exists (
  select 1 from public.trips
  where id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid
    and (
      traveller_id <> v_demo_traveller_id::uuid
      or origin_country <> 'US'
      or destination_country <> 'GB'
      or origin_airport_code <> 'SFO'
      or destination_airport_code <> 'LHR'
      or status <> 'DRAFT'
    )
) then
  raise exception 'SEED FAILED: Trip ID b2c3d4e5-f6a7-8901-bcde-f12345678901 exists with incompatible data';
end if;

-- Request 1 conflict check
if exists (
  select 1 from public.requests
  where id = 'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid
    and (
      buyer_id <> v_demo_buyer_id::uuid
      or origin_country <> 'IN'
      or destination_country <> 'IN'
      or origin_airport_code <> 'DEL'
      or destination_airport_code <> 'BOM'
    )
) then
  raise exception 'SEED FAILED: Request ID c3d4e5f6-a7b8-9012-cdef-123456789012 exists with incompatible data';
end if;

-- Request 2 conflict check
if exists (
  select 1 from public.requests
  where id = 'd4e5f6a7-b8c9-0123-def1-234567890123'::uuid
    and (
      buyer_id <> v_demo_buyer_id::uuid
      or origin_country <> 'IN'
      or destination_country <> 'IN'
      or origin_airport_code <> 'BOM'
      or destination_airport_code <> 'DEL'
    )
) then
  raise exception 'SEED FAILED: Request ID d4e5f6a7-b8c9-0123-def1-234567890123 exists with incompatible data';
end if;

-- Request 3 conflict check
if exists (
  select 1 from public.requests
  where id = 'e5f6a7b8-c9d0-1234-ef12-345678901234'::uuid
    and (
      buyer_id <> v_demo_buyer_id::uuid
      or origin_country <> 'GB'
      or destination_country <> 'IN'
      or origin_airport_code <> 'LHR'
      or destination_airport_code <> 'BOM'
    )
) then
  raise exception 'SEED FAILED: Request ID e5f6a7b8-c9d0-1234-ef12-345678901234 exists with incompatible data';
end if;

-- =============================================
-- SEED TRIPS TABLE
-- =============================================

-- Trip 1: Delhi to Mumbai (domestic)
insert into public.trips (
  id, traveller_id, origin_country, origin_airport_code,
  destination_country, destination_airport_code, departure_at, arrival_at,
  capacity_kg, status
)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  v_demo_traveller_id::uuid,
  'IN', 'DEL', 'IN', 'BOM',
  now() + interval '15 days',
  now() + interval '15 days' + interval '2 hours',
  20.00, 'DRAFT'
)
on conflict (id) do nothing;

-- Trip 2: San Francisco to London (international)
insert into public.trips (
  id, traveller_id, origin_country, origin_airport_code,
  destination_country, destination_airport_code, departure_at, arrival_at,
  capacity_kg, status
)
values (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,
  v_demo_traveller_id::uuid,
  'US', 'SFO', 'GB', 'LHR',
  now() + interval '60 days',
  now() + interval '60 days' + interval '10 hours',
  25.00, 'DRAFT'
)
on conflict (id) do nothing;

-- =============================================
-- SEED REQUESTS TABLE
-- =============================================

-- Request 1: Laptop from Delhi to Mumbai
-- Route DEL->BOM matches Trip 1
-- needed_by is AFTER trip arrival (matching condition: departure_at <= needed_by, arrival_at <= needed_by)
insert into public.requests (
  id, buyer_id, origin_country, origin_airport_code,
  destination_country, destination_airport_code, needed_by,
  product_title, product_category, quantity, declared_value_minor,
  declared_currency, hs_code, fulfilment_mode, is_for_third_party,
  compliance_status, request_status, compliance_reason
)
values (
  'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid,
  v_demo_buyer_id::uuid,
  'IN', 'DEL', 'IN', 'BOM',
  now() + interval '30 days',
  'High-performance laptop for business travel',
  'electronics', 1, 850000,
  'INR', '85171200', 'PASSENGER_BAGGAGE', false,
  'REVIEW_REQUIRED', 'PENDING_REVIEW',
  array['Manual compliance review required before matching.']::text[]
)
on conflict (id) do nothing;

-- Request 2: Winter coat from Mumbai to Delhi
-- Route BOM->DEL matches reverse of Trip 1
insert into public.requests (
  id, buyer_id, origin_country, origin_airport_code,
  destination_country, destination_airport_code, needed_by,
  product_title, product_category, quantity, declared_value_minor,
  declared_currency, hs_code, fulfilment_mode, is_for_third_party,
  compliance_status, request_status, compliance_reason
)
values (
  'd4e5f6a7-b8c9-0123-def1-234567890123'::uuid,
  v_demo_buyer_id::uuid,
  'IN', 'BOM', 'IN', 'DEL',
  now() + interval '15 days',
  'Premium winter wool coat - size L',
  'clothing', 1, 12000,
  'INR', '61041000', 'PASSENGER_BAGGAGE', true,
  'REVIEW_REQUIRED', 'PENDING_REVIEW',
  array['Manual compliance review required before matching.']::text[]
)
on conflict (id) do nothing;

-- Request 3: Textbooks from London to Mumbai
-- International request for demonstration
insert into public.requests (
  id, buyer_id, origin_country, origin_airport_code,
  destination_country, destination_airport_code, needed_by,
  product_title, product_category, quantity, declared_value_minor,
  declared_currency, hs_code, fulfilment_mode, is_for_third_party,
  compliance_status, request_status, compliance_reason
)
values (
  'e5f6a7b8-c9d0-1234-ef12-345678901234'::uuid,
  v_demo_buyer_id::uuid,
  'GB', 'LHR', 'IN', 'BOM',
  now() + interval '55 days',
  'University textbook collection - semester 5 subjects',
  'books', 5, 45000,
  'INR', '49019900', 'PASSENGER_BAGGAGE', false,
  'REVIEW_REQUIRED', 'PENDING_REVIEW',
  array['Manual compliance review required before matching.']::text[]
)
on conflict (id) do nothing;

commit;

-- =============================================
-- SUMMARY REPORT
-- =============================================
do $$
declare
  v_trips int;
  v_requests int;
begin
  select count(*) into v_trips from public.trips
  where id in (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  );
  select count(*) into v_requests from public.requests
  where id in (
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    'd4e5f6a7-b8c9-0123-def1-234567890123',
    'e5f6a7b8-c9d0-1234-ef12-345678901234'
  );

  raise notice '=== DEMO DATA SEEDING COMPLETE ===';
  raise notice 'Trips inserted: %, Requests inserted: %', v_trips, v_requests;
  raise notice 'Trips are DRAFT. Set to ACTIVE for matching.';
  raise notice 'Requests are PENDING_REVIEW. Admin must approve for OPEN matching.';
end;
$$;

-- =============================================
-- END OF SEED SCRIPT
-- =============================================