-- Portal demo bootstrap (run once in the Supabase SQL Editor)
--
-- WHY THIS EXISTS
--   New signups are created as buyer/PENDING by the auth trigger, and role /
--   account_status / kyc_status are server-managed (clients cannot self-promote).
--   The only bootstrap step that cannot be done through the API is creating the
--   first admin. Everything else below is performed live through the admin API
--   so the demo can show the real provisioning / KYC flow.
--
-- PREREQUISITE
--   Register three accounts in the frontend (Supabase Auth): one to act as the
--   demo operator (admin), one buyer, one traveller. Auth creates their profiles
--   automatically. Then replace <ADMIN_USER_ID> below with that user's id and run
--   this script. The SQL Editor runs as the postgres role, the only context
--   permitted to change these protected columns.
--
-- MOCK DATA ONLY. Do not use real customer identity information.

update public.profiles
   set role = 'admin',
       account_status = 'ACTIVE',
       kyc_status = 'VERIFIED'
 where id = '<ADMIN_USER_ID>';

-- After this, drive the rest of the demo through the API (all admin-only):
--   1. POST /admin/profiles/<buyer_id>/role        { "role": "buyer" }       -> activates buyer
--   2. POST /admin/profiles/<traveller_id>/role     { "role": "traveller" }   -> traveller PENDING
--   3. POST /kyc/submit                             (as traveller)           -> KYC SUBMITTED
--   4. POST /admin/profiles/<traveller_id>/kyc-review { "decision": "VERIFIED", "providerReference": "MOCK-KYC-DEMO-0001" }
--   5. (traveller creates a trip, then) POST /admin/trips/<trip_id>/activate   -> trip ACTIVE
--   6. Continue the marketplace + transaction happy path.
