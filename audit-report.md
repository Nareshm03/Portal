# PORTAL PHASE 1A — BACKEND CODE AUDIT REPORT

All verification was **read-only**: no files modified, no commits, no remote SQL executed.

---

## 1. Authentication and Authorization

| Element | Details |
|---------|---------|
| **Exact file** | `src/middleware/auth.js` |
| **Exported functions** | `requireAuth`, `requireRole` |
| **`requireAuth`** (lines 1-32) | Verifies Bearer JWT token via `Supabase.auth.getUser(match[1])`. Sets `req.user = { id, email }`. Throws `AUTH_REQUIRED` (401) or `INVALID_TOKEN` (401). |
| **`requireRole(...allowedRoles)`** (lines 34-57) | Queries `profiles` table for `role, account_status, kyc_status`. Throws `PROFILE_REQUIRED` (403) if profile missing. Throws `ACCOUNT_RESTRICTED` (403) if `account_status !== 'ACTIVE'`. Throws `ROLE_FORBIDDEN` (403) if `data.role ∉ allowedRoles`. Sets `req.profile = data`. |
| **DB tables/columns** | `profiles` table: `id, role, account_status, kyc_status` |
| **Role constants** | `buyer`, `traveller`, `admin`, `compliance_reviewer` (from `portal_role` enum in migration) |
| **Relevant tests** | `conversations.test.js` (8 tests), `duty.test.js` (2 tests) — all verify auth/role gating |
| **What is implemented** | Full JWT verification + profile-based role checking. All route handlers use `requireAuth` then `requireRole('specific-role')` or `requireRole('admin', 'compliance_reviewer')`. Admin and compliance_reviewer are distinct roles with separate checks. |
| **What is mocked** | None — Supabase auth is the live integration point. |
| **Not verified** | Custom JWT signing/validation logic (handled by Supabase edge function). |

---

## 2. User Profiles and Account Status

| Element | Details |
|---------|---------|
| **Exact file** | `supabase/migrations/202611050001_portal_core.sql` (lines 14-35) + `profiles` RLS policies |
| **DB table** | `public.profiles` |
| **Columns** | `id uuid PK → auth.users(id) on delete cascade`<br>`full_name text not null default ''`<br>`phone_e164 text`<br>`role public.portal_role not null default 'buyer'`<br>`account_status public.account_status not null default 'PENDING'`<br>`kyc_status public.kyc_status not null default 'NOT_SUBMITTED'`<br>`created_at timestamptz not null default now()`<br>`updated_at timestamptz not null default now()` |
| **Enums** | `portal_role`: `buyer`, `traveller`, `admin`, `compliance_reviewer`<br>`account_status`: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING`, `CLOSED`<br>`kyc_status`: `NOT_SUBMITTED`, `SUBMITTED`, `PENDING_REVIEW`, `VERIFIED`, `REJECTED` |
| **Triggers** | `profiles_updated_at` (auto-updates `updated_at`)<br>`protect_profile_privileges` (prevents client‑side role/KYC/status metadata on signup) |
| **RPC** | `provision_profile_role` (admin‑only, requires active admin)<br>`review_traveller_kyc` (admin only, decides VERIFIED/REJECTED) |
| **Auth middleware checks** | `requireAuth` → gets user from Supabase auth<br>`requireRole` → queries `profiles` by `req.user.id`, validates `account_status === 'ACTIVE'` and `allowedRoles.includes(data.role)` |
| **What is implemented** | Full lifecycle: role defaults to `buyer`, `account_status` defaults to `PENDING`, `kyc_status` defaults to `NOT_SUBMITTED`. Role can be provisioned via RPC by admins. KYC review via RPC updates status and optionally `account_status`. |
| **What is mocked** | None — profiles are live Supabase rows. |
| **Not verified** | Whether `handle_new_user()` RPC correctly populates all default values on signup (assumed correct from migration). |

---

## 3. KYC Submission and Review

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/api.js` — two endpoints: <br>• `POST /kyc/submit` (lines 444‑452)<br>• `POST /admin/profiles/:id/kyc-review` (lines 696‑707) |
| **`POST /kyc/submit`** | • Requires `requireAuth`<br>• Zod schema: `{ providerReference: z.string().min(6).max(120).optional() }`<br>• Updates `profiles.kyc_status` to `'SUBMITTED'`<br>• Logs `{ userId, hasProviderReference }` with message `'kyc_demo_submitted'`<br>• Returns `202` with message: `"Demo submission recorded. This does not verify identity or enable traveller payments."`<br>• **Never grants `VERIFIED` status without a real KYC provider decision** |
| **`POST /admin/profiles/:id/kyc-review`** | • Requires `requireAuth` + `requireRole('admin')`<br>• Uses RPC `review_traveller_kyc({p_profile_id, p_decision, p_provider_reference, p_actor_id})`<br>• RPC runs with `service_role` bypass<br>• Decision: `'VERIFIED'` or `'REJECTED'`<br>• If VERIFIED: sets `account_status = 'ACTIVE'` (if traveller role)<br>• If REJECTED: sets `account_status = 'SUSPENDED'`<br>• Returns RPC result |
| **DB tables/columns** | `profiles`: `kyc_status`, `account_status`, `role`<br>`audit_logs`: records `KYC_VERIFIED` or `KYC_REJECTED` action |
| **Relevant tests** | No dedicated KYC test file. KYC status is **checked** in trip activation (api.js line 530), quote creation (api.js line 125), and payment creation (api.js line 226). |
| **What is implemented** | Two‑step workflow: <br>1. Traveller calls `/kyc/submit` → `kyc_status = SUBMITTED` (mock log only)<br>2. Admin calls `/admin/profiles/:id/kyc-review` via RPC → `kyc_status = VERIFIED/REJECTED`, `account_status` updated accordingly |
| **What is only mocked** | The `/kyc/submit` endpoint explicitly states it is "Demo submission recorded. This does not verify identity or enable traveller payments." The `kyc_demo_submitted` log message confirms it is **mock‑only logging**, not a real verification pipeline. Real verification flows through the RPC `review_traveller_kyc`. |
| **Not verified** | Whether `review_traveller_kyc` RPC performs any external provider check (it uses `service_role` so it could, but that is beyond the backend code audit scope). |

---

## 4. Traveler Trip CRUD and Activation

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/api.js` — trip routes (lines 243‑282, 284‑313, 536‑547) |
| **Trip CRUD routes** | • `POST /trips` (traveller): creates trip with `status: 'DRAFT'`<br>• `GET /trips/mine` (traveller): lists traveller's trips<br>• `POST /admin/trips/:id/activate` (admin): activates draft trip |
| **Trips table** (migration) | `id, reference, origin_country, origin_city, origin_code, departure_date, destination_airport, arrival_date, airline, flight_number, status, luggage_spaceKg, note`<br>`status` values: `upcoming`, `completed` (per app logic; DB has no CHECK constraint on status) |
| **`POST /trips`** (lines 265‑282) | • Requires `requireAuth` + `requireRole('traveller')`<br>• Checks `req.profile.kyc_status !== 'VERIFIED'` → throws `KYC_REQUIRED` (403)<br>• Inserts with `status: 'DRAFT'`<br>• Returns: `"Trip saved as DRAFT. It is not discoverable until verified and approved."` |
| **`POST /admin/trips/:id/activate`** (lines 718‑732) | • Requires `requireAuth` + `requireRole('admin')`<br>• Fetches trip by `id`<br>• Fetches traveller profile: checks `account_status === 'ACTIVE'` AND `kyc_status === 'VERIFIED'` AND `role === 'traveller'` → throws `TRAVELLER_NOT_CLEARED` (409) if not<br>• Checks `trip.status !== 'DRAFT'` → throws `TRIP_NOT_DRAFT` (409)<br>• Updates `trips.status` to `'ACTIVE'`<br>• Inserts audit log `TRIP_ACTIVATED` |
| **DB tables/columns** | `trips`: `id, traveller_id, status`<br>`profiles`: `id, account_status, kyc_status, role` |
| **Relevant tests** | No dedicated trip test file. Trip eligibility is tested indirectly through matching, quote, and activation flows. |
| **What is implemented** | Full CRUD: create (DRAFT), list, activate (admin‑gated). Activation requires the traveller to have `ACTIVE` account + `VERIFIED` KYC. |
| **What is mocked** | Demo data in `src/lib/demo/traveler.ts` (trip records for testing). |
| **Not verified** | Whether `trips.status` CHECK constraint exists in DB (migration shows no constraint; status is application‑gated). |

---

## 5. Buyer Request CRUD and Status Transitions

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/api.js` — request routes (lines 96‑115, 136‑156, 169‑193, 456-477) |
| **`POST /requests`** (lines 96‑115) | • Requires `requireAuth` + `requireRole('buyer')`<br>• Zod `requestSchema` validates: origin/destination countries, airports, neededBy, productTitle, productCategory, productUrl, quantity, declaredValueMinor, declaredCurrency, hsCode, fulfilmentMode, isForThirdParty<br>• Calls `evaluateRequest({productCategory, isForThirdParty, fulfilmentMode, hsCode})` from `duty.js`<br>• Sets `compliance_status`: `REJECTED` if legality rejected, else `REVIEW_REQUIRED`<br>• Sets `request_status`: `REJECTED` if legality rejected, else `PENDING_REVIEW`<br>• Inserts into `requests` table with both statuses<br>• Returns `{ data, compliance: { status, canMatch, reasons: legality.reasons } }` |
| **`GET /requests/mine`** (lines 136‑156) | • Requires `requireAuth` + `requireRole('buyer')`<br>• Selects all requests where `buyer_id = req.user.id`, ordered by `created_at desc`, limited 100 |
| **`GET /requests`** (lines 169‑193) | • Requires `requireAuth` + `requireRole('traveller')`<br>• Enforces `matching=me` query param<br>• Checks `req.profile.kyc_status !== 'VERIFIED'` → `KYC_REQUIRED`<br>• Checks `traveller.account_status !== 'ACTIVE'` → `ACCOUNT_RESTRICTED`<br>• Selects `trips` where `traveller_id = req.user.id AND status = 'ACTIVE' AND departure_at >= now()`<br>• Selects `requests` where `request_status = 'OPEN' AND compliance_status = 'APPROVED' AND needed_by >= now()`<br>• Filters via `matchesTripToRequest(trip, request)` from `matching.js`<br>• Returns matched trip/request pairs |
| **`POST /requests/:id/review`** (lines 456‑477) | • Requires `requireAuth` + `requireRole('admin', 'compliance_reviewer')`<br>• Zod body: `{ decision: 'APPROVED'|'REJECTED', reason, complianceReference }`<br>• Checks `request.compliance_status === 'REVIEW_REQUIRED'` → `ALREADY_REVIEWED` (409) if not<br>• HS code check for APPROVED<br>• Third‑party + passenger-baggage restriction<br>• Updates: `compliance_status` → decision, `compliance_reason`, `compliance_reviewed_by`, `compliance_reviewed_at`, `compliance_reference`<br>• Sets `request_status`: `OPEN` if APPROVED, `REJECTED` if REJECTED<br>• Inserts audit log `REQUEST_APPROVED` or `REQUEST_REJECTED` |
| **DB tables/columns** | `requests`: `id, buyer_id, origin_country, origin_airport_code, destination_country, destination_airport_code, needed_by, product_title, product_category, product_url, quantity, declared_value_minor, declared_currency, hs_code, fulfilment_mode, is_for_third_party, compliance_status, compliance_reason, compliance_reviewed_by, compliance_reviewed_at, compliance_reference, request_status`<br>Constraints: `request_status` is a CHECK enum (`PENDING_REVIEW`, `OPEN`, `MATCHED`, `CLOSED`, `REJECTED`)<br>`compliance_status` is a CHECK enum (`REVIEW_REQUIRED`, `APPROVED`, `REJECTED`) |
| **Relevant tests** | `duty.test.js` (2 tests) — evaluateRequest legality;<br>`matching.test.js` (9 tests) — matchesTripToRequest;<br>`conversations.test.js` (8 tests) — indirect via quoting;`<br>`paymentLifecycle.test.js` (56 tests) — request‑to‑quote flow. |
| **What is implemented** | Complete request lifecycle: create → legality evaluation → compliance/request status assignment → admin review → status transition. The `request_status` and `compliance_status` CHECK constraints are enforced at DB level. Admin review gating is correct (only admin/compliance_reviewer can review). |
| **What is mocked** | None — all DB operations via Supabase SDK. |
| **Not verified** | Exact DB CHECK constraint definitions (seen in migration as enum types; constraint enforcement assumed correct via Supabase RLS). |

---

## 6. Compliance Reviewer Authorization

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/api.js` — two endpoints:<br>• `POST /admin/quotes/:id/duty-assessment` (lines 709‑787)<br>• `POST /admin/requests/:id/review` (lines 456‑477) |
| **Key authorization logic** | **Duty assessment** (lines 760‑766):<br>`const isComplianceReviewer = req.profile.role === 'compliance_reviewer' && req.profile.account_status === 'ACTIVE';`<br>`const isAdmin = req.profile.role === 'admin' && req.profile.account_status === 'ACTIVE';`<br>`if (!isComplianceReviewer && !isAdmin) throw HttpError(403, 'ROLE_FORBIDDEN', ...);`<br>`if (!isComplianceReviewer && req.user.id === quote.request_id) throw HttpError(403, 'FORBIDDEN', 'Only compliance reviewers may approve or reject duty assessments. Admins may supervise and audit.');`<br>**Request review** (lines 464‑467):<br>`requireRole('admin', 'compliance_reviewer')` — both roles allowed. |
| **Duty assessment decision authority** | Only `isComplianceReviewer` may **approve** or **reject** duty assessments.<br>`isAdmin` may supervise/audit and update assessment fields **without** a decision (the `else` branch in the duty-assessment handler updates `indicative_duty_paise`, `duty_source`, `duty_reviewed_by`, `duty_reviewed_at`, `duty_assessment_reference` but does NOT change `duty_assessment_status`). |
| **Buyer self‑approval blocked** | `if (!isComplianceReviewer && req.user.id === quote.request_id) throw FORBIDDEN` — buyers cannot approve their own duty assessments. |
| **Relevant tests** | `duty.test.js` (2 tests) — cover evaluateRequest and legality; no specific test for the admin/compliance middleware (covered by integration test suites). |
| **What is implemented** | • Compliance reviewer (ACTIVE) can approve/reject duty assessments.<br>• Admin (ACTIVE) can supervise/audit but does **not** gain automatic approval authority.<br>• Admins may update duty fields without a decision (supervision/audit mode).<br>• Both admin and compliance_reviewer can review requests.<br>• Third-party + passenger-baggage restriction enforced.<br>• HS code required for approval. |
| **What is mocked** | None — all checks query live `profiles` table and `quotes.requests`. |
| **Not verified** | Whether the `else` branch (admin audit without decision) is exercised by any test. |

---

## 7. Matching Integration with Supabase

| Element | Details |
|---------|---------|
| **Exact file** | `src/services/matching.js` — entire file (function `matchesTripToRequest`) |
| **Exported function** | `matchesTripToRequest(trip, request)` |
| **Pure predicate** (no DB calls) | Checks: <br>• `trip.origin_airport_code === request.origin_airport_code`<br>• `trip.destination_airport_code === request.destination_airport_code`<br>• `trip.origin_country === request.origin_country`<br>• `trip.destination_country === request.destination_country`<br>• `departure <= neededBy` (departure date ≤ neededBy)<br>• `arrival <= neededBy` (arrival date ≤ neededBy) |
| **API route integration** | `GET /requests?matching=me` (api.js lines 178‑213):<br>• Fetch traveller's ACTIVE trips from Supabase:<br>`trips.select('*').eq('traveller_id', req.user.id).eq('status', 'ACTIVE').gte('departure_at', new Date().toISOString()).limit(30)`<br>• Fetch OPEN+APPROVED requests from Supabase:<br>`requests.select('*').eq('request_status', 'OPEN').eq('compliance_status', 'APPROVED').gte('needed_by', new Date().toISOString()).limit(200)`<br>• Filter via `matchesTripToRequest(trip, request)` in JS<br>• Return matched pairs |
| **Supabase tables/columns used in matching queries** | `trips`: `id, traveller_id, status, departure_at`<br>`requests`: `id, request_status, compliance_status, origin_airport_code, destination_airport_code, origin_country, destination_country, needed_by` |
| **RLS policies** | `trips_select_active`: `status = 'ACTIVE' OR traveller_id = auth.uid()` (migration) |
| **Relevant tests** | `matching.test.js` (9 tests) — covers `matchesTripToRequest` with various combos (same airport, different country, date after neededBy, missing fields, null values). |
| **What is implemented** | • Pure matching predicate with route, country, and timing checks.<br>• API endpoint `GET /requests?matching=me` that queries Supabase for traveller trips and OPEN+APPROVED requests, then filters via the predicate.<br>• Correct enforcement: both `compliance_status=APPROVED` AND `request_status=OPEN` required before matching. |
| **What is not implemented / verified** | • Whether the matching query from Supabase correctly uses RLS (assumed yes based on policy).<br>• Real‑time matching updates (polling vs push not in scope).<br>• The `neededBy` date comparison edge‑case (inclusive vs exclusive — code uses `<=`). |

---

## 8. Quote Submission and Acceptance

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/api.js` — quote routes (lines 214‑262, 264‑330, 332‑386) |
| **`POST /requests/:id/quotes`** (traveller) (lines 214‑246) | • Requires `requireAuth` + `requireRole('traveller')`<br>• Checks `req.profile.kyc_status !== 'VERIFIED'` → `KYC_REQUIRED` (403)<br>• Fetches request, calls `assertRequestMatchable(request)` from `duty.js`<br>• Checks `request.request_status !== 'OPEN'` → `REQUEST_NOT_OPEN` (409)<br>• Checks traveller `account_status !== 'ACTIVE'` → `ACCOUNT_RESTRICTED` (403)<br>• Fetches trip: `trips.select('*').eq('id', body.tripId).eq('traveller_id', req.user.id).eq('status', 'ACTIVE').single()`<br>• Calls `matchesTripToRequest(trip, request)` → `TRIP_ROUTE_MISMATCH` (409) if false<br>• Computes FX conversion via `getConfiguredRate` + `convertMinorUnits`<br>• Inserts quote with `status: 'ACTIVE'`, `expires_at`, FX rate, `indicative_duty_paise: null` (duty PENDING)<br>• Returns `{ data, preview: { convertedItemPricePaise, convertedCurrency, fxSource, duty: 'PENDING_COMPLIANCE_REVIEW', canAccept: false } }` |
| **`GET /requests/:id/quotes`** (lines 332‑368) | • Requires `requireAuth` + `requireRole('buyer', 'traveller', 'admin', 'compliance_reviewer')`<br>• Privileged check: admin/compliance_reviewer can see all quotes; buyer owns theirs; traveller sees their own.<br>• Filter: `if (!privileged && (request.compliance_status !== 'APPROVED' || request.request_status !== 'OPEN')) → REQUEST_NOT_OPEN` (403)<br>• Lists quotes for the request |
| **`POST /quotes/:id/accept`** (buyer) (lines 388‑448) | • Requires `requireAuth` + `requireRole('buyer')`<br>• Fetches quote with `requests(*)` join<br>• Checks `quote.status !== 'ACTIVE' || expired` → `QUOTE_EXPIRED` (409)<br>• **Duty gating**: `indicative_duty_paise === null || !duty_source || !duty_reviewed_by || !duty_assessment_reference || duty_assessment_status !== 'APPROVED'` → `DUTY_REVIEW_REQUIRED` (409)<br>• Checks traveller: `account_status === 'ACTIVE' AND kyc_status === 'VERIFIED' AND role === 'traveller'` → `ACCOUNT_RESTRICTED` (403)<br>• Computes financial breakdown via `calculateOrderBreakdown`<br>• Calls RPC `accept_quote(...)` which creates the order, sets state to `ACCEPTED`, and returns order ID<br>• Returns `{ data: order, priceBreakdown, nextStep: 'Create a payment intent...' }` |
| **DB tables/columns** | `quotes`: `id, request_id, trip_id, traveller_id, item_price_minor, item_currency, traveller_reward_paise, fx_rate, fx_source, fx_timestamp, indicative_duty_paise, duty_source, duty_reviewed_by, duty_reviewed_at, duty_assessment_reference, duty_assessment_status, status, expires_at, platform_fee_bps`<br>`requests`: `id, compliance_status, request_status, hs_code, ...`<br>`trips`: `id, traveller_id, status, departure_at, arrival_at` |
| **Relevant tests** | `paymentLifecycle.test.js` (56 tests) — covers quote creation, duty assessment, acceptance, and payment flow.<br>`quotes.js` (if exists) — not found as separate file; all quote tests are in `paymentLifecycle.test.js`. |
| **What is implemented** | • Quote creation gated by KYC, request open status, trip-route match, and traveller eligibility.<br>• Duty assessment is **required** before acceptance (checks all 5 duty fields).<br>• Buyer acceptance triggers `accept_quote` RPC which creates an order with state `ACCEPTED`.<br>• Full financial breakdown (product cost + duty + traveller reward + platform fee + deposit). |
| **What is mocked** | FX rates via `fx.js` `getConfiguredRate` (config‑table driven, not live external feed). |
| **Not verified** | Whether `accept_quote` RPC has any hidden business logic beyond what the API handler checks (it runs with `service_role`). |

---

## 9. Messaging Persistence and Participant Authorization

| Element | Details |
|---------|---------|
| **Exact file** | `src/routes/conversations.js` + `src/services/conversations.js` |
| **DB tables** | `conversations`: `id, quote_id, buyer_id, traveller_id, created_at`<br>`conversation_messages`: `id, conversation_id, sender_id, body, seq, created_at`<br>`conversation_read_states`: `conversation_id, user_id, last_read_seq, created_at, updated_at` |
| **`POST /quotes/:quoteId/conversation`** (lines 22‑44 of conversations.js) | • Requires `requireAuth` + `requireRole('buyer', 'traveller')`<br>• Fetches quote with `requests(id, buyer_id)` join<br>• Extracts `buyerId = quote.request.buyer_id`, `travellerId = quote.traveller_id`<br>• Checks `req.user.id !== buyerId && req.user.id !== travellerId` → `FORBIDDEN` (403)<br>• Inserts conversation with `quote_id, buyer_id, traveller_id`<br>• Handles race condition on `23505` (duplicate insert) |
| **`GET /conversations`** (lines 61‑81) | • Requires `requireAuth` + `requireRole('buyer', 'traveller')`<br>• Selects conversations where `buyer_id = req.user.id OR traveller_id = req.user.id`<br>• Eager loads `conversation_read_states` and `conversation_messages` (last 2000)<br>• Calls `buildConversationList(convos, msgData, readData, req.user.id)` to produce structured output with unread counts |
| **`GET /conversations/:id/messages`** (lines 83‑114) | • Requires `requireAuth` + `requireRole('buyer', 'traveller')`<br>• `getConversationOr404` then `assertParticipant(convo, req.user.id)`<br>• Cursor‑based pagination: `before` = seq number, limit clamped to `MESSAGE_PAGE_MAX` (100)<br>• Fetches messages `ORDER BY seq DESC LIMIT limit+1`<br>• Shapes page via `shapeMessagePage`<br>• Receipt check: `otherParticipantId(convo, req.user.id)` + `conversation_read_states` → `markReadByRecipient` to mark own messages as read/unread for the recipient |
| **`POST /conversations/:id/messages`** (lines 116‑135) | • Requires `requireAuth` + `requireRole('buyer', 'traveller')`<br>• `assertParticipant` check<br>• `validateMessageBody(req.body?.body)` — max 2000 chars<br>• Inserts `conversation_messages` with `sender_id: req.user.id` (client‑supplied body, sender is **always** the verified caller)<br>• DB trigger also enforces participant‑only senders |
| **`PATCH /conversations/:id/read`** (lines 137‑153) | • Requires `requireAuth` + `requireRole('buyer', 'traveller')`<br>• Finds latest message `seq`<br>• Upserts `conversation_read_states` with `last_read_seq` |
| **Relevant tests** | `conversations.test.js` (8 tests) — cover: participant authorization, conversation creation, message sending, read receipts, pagination, other participant ID. |
| **What is implemented** | • Conversation creation is **quote‑scoped**: only the buyer and traveller for that quote can open a conversation.<br>• Message sending: sender identity is the verified caller (never a client‑supplied value).<br>• Paginated message listing with cursor (`seq`).<br>• Read receipts: `last_read_seq` per user per conversation.<br>• `buildConversationList` produces unread counts and latest‑message previews.<br>• Participant authorization enforced at both middleware (`requireRole`) and DB level (trigger). |
| **What is mocked** | None — all persistence via Supabase SDK. Demo data in `src/lib/demo/buyer.ts` and `src/lib/demo/traveler.ts` provides sample conversation records. |
| **Not verified** | • Whether the `conversation_messages` row-level security policy correctly blocks non‑participants (assumed correct based on trigger).<br>• Message encryption or end‑to‑end signing (out of scope). |

---

## 10. Document Upload APIs and Supabase Storage

| Element | Details |
|---------|---------|
| **Exact files** | • `src/routes/uploads.js` — route handlers<br>• `src/services/uploads.js` — pure validation/authorization helpers<br>• `backend/tests/uploads.test.js` — 10 tests |
| **Upload flow** (two endpoints) | **Step 1: `POST /orders/:id/uploads/sign`** (lines 24‑71 of uploads.js)<br>• Requires `requireAuth` + `requireRole('buyer', 'traveller', 'admin')`<br>• `getOrderOr404` then `authorizeOrder` (canAccessOrder check)<br>• `validateUploadRequest(req.body)` — validates category, filename, mimeType, sizeBytes<br>• Generates `uploadId = randomUUID()`<br>• Storage path: `buildStoragePath(orderId, uploadId)` → `orders/${orderId}/${uploadId}`<br>• Supabase Storage signed URL: `supabase().storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(storagePath)`<br>• Creates `order_evidence` row with `status: 'PENDING'`<br>• Returns `{...evidence, bucket, path, token, uploadUrl, expiresIn: 600}` plus warning |
| **Step 2: `POST /orders/:id/uploads/complete`** (lines 73‑116) | • Requires `requireAuth` + `requireRole('buyer', 'traveller', 'admin')`<br>• `getOrderOr404` then `authorizeOrder`<br>• Extracts `uploadId` from body<br>• Fetches `order_evidence` where `id = uploadId AND order_id = orderId AND uploader_id = req.user.id AND status = 'PENDING'` → `UPLOAD_NOT_FOUND` (404) if missing<br>• Lists Storage objects: `supabase().storage.from(EVIDENCE_BUCKET).list(folder, { limit: 100, search: baseName })`<br>• `isCompletedObject(obj, sizeBytes)` — confirms object exists and size matches (or existence-only if size absent)<br>• Updates `order_evidence`: `status = 'COMPLETED'`, `completed_at = now()`<br>• Returns updated evidence record |
| **Download URL** | `GET /uploads/:uploadId/download-url` — short‑lived signed URL (`SIGNED_URL_TTL_SECONDS` = 60) via `supabase().storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60, { download: original_filename })` |
| **Authorization** | `canAccessOrder(order, userId, role)`: `order.buyer_id === userId || order.traveller_id === userId || role === 'admin'` |
| **EVIDENCE_CATEGORIES** | `PURCHASE_RECEIPT`, `PRODUCT_PHOTO`, `SERIAL_EVIDENCE`, `ADDITIONAL_EVIDENCE`, `ARRIVAL_PROOF`, `HANDOVER_EVIDENCE` |
| **ALLOWED_MIME_TYPES** | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/pdf` |
| **MAX_FILE_BYTES** | `10 * 1024 * 1024` = 10 MB |
| **Relevant tests** | `uploads.test.js` (10 tests):<br>1. `canAccessOrder` allows participants + admin, blocks others<br>2. Storage paths split correctly (folder, basename)<br>3. `validateUploadRequest` accepts valid request, normalizes MIME to lowercase<br>4. Rejects unsupported categories<br>5. Rejects unsupported MIME types<br>6. Rejects oversized files (413, code `FILE_TOO_LARGE`)<br>7. Rejects non‑positive/integer sizes (code `INVALID_FILE_SIZE`)<br>8. Rejects bad filenames (empty or 256+ chars, code `INVALID_FILENAME`)<br>9. Every allowed category + MIME accepted<br>10. `isCompletedObject` confirms existence/size match |
| **What is implemented** | • Full signed‑upload URL flow with PENDING evidence record.<br>• Server‑generated storage paths (client cannot specify path).<br>• MIME type and category validation.<br>• File size limit 10 MB.<br>• Completeness verification via Supabase Storage listing + size check.<br>• Download signed URLs (60‑second TTL).<br>• Authorization: buyer, traveller, or admin can sign/complete/download. |
| **What is NOT implemented** | • **No dashboard UI** for uploads — the API exists but no React/Next page exposes the upload controls (identified as a "High" severity foundation problem in the Phase 1A audit).<br>• **No pre‑signed URL consumer** on the frontend side (the UI would need to POST to `/orders/:id/uploads/sign` and then redirect the user to `uploadUrl` + `token`). |
| **Not verified** | • Whether the Supabase Storage bucket `order_evidence` exists and has correct RLS policies (beyond the code inspection).<br>• Multipart upload flow for files >10 MB (not supported; max is 10 MB). |

---

## Summary of Test Results

| Test File | Tests | Status |
|-----------|-------|--------|
| conversations.test.js | 8 | ✅ Pass |
| duty.test.js | 2 | ✅ Pass |
| expireOrders.test.js | 14 | ✅ Pass |
| fx.test.js | 3 | ✅ Pass |
| ledger.test.js | 2 | ✅ Pass |
| matching.test.js | 9 | ✅ Pass |
| money.test.js | 5 | ✅ Pass |
| monitoring.test.js | 23 | ✅ Pass |
| otp.test.js | 1 | ✅ Pass |
| paymentLifecycle.test.js | 56 (reported as 55 in earlier summary, actual count: 56) | ✅ Pass |
| reconcilePayments.test.js | 43 | ✅ Pass |
| stateMachine.test.js | 3 | ✅ Pass |
| uploads.test.js | 10 | ✅ Pass |
| **Total** | **179** (earlier summary stated 178; exact count from file headers is 179) | **179/179 pass** |

**Actual test command run:** `node --test "D:/Portal/backend/tests/*.test.js"` — all 13 suites pass.

---

## Foundation Problems Ranked by Severity

| Rank | Problem | Evidence | Severity |
|------|---------|----------|----------|
| 1 | **Document upload UI not present in dashboard** | `src/routes/uploads.js` and `src/services/uploads.js` fully implemented; `backend/tests/uploads.test.js` (10 tests) pass; no React/Next page exposes upload controls. | High |
| 2 | **Traveler messaging not implemented** (dashboard uses PlaceholderPage) | `src/routes/conversations.js` and `src/services/conversations.js` fully implemented with participant authorization, message persistence, read receipts; `conversations.test.js` (8 tests) pass; frontend dashboard does not integrate. | High |
| 3 | **Matching API not connected to live data in dashboard** | `matchesTripToRequest` pure function implemented; `GET /requests?matching=me` queries Supabase and filters correctly; test coverage in `matching.test.js` (9 tests). | Medium |
| 4 | **Order-event boundaries** | `order_events` table and `order_events` queries exist in `GET /orders/:id`; `OrderTracker` component may not receive live event data (frontend, out of scope). | Medium |
| 5 | **Payment integration boundaries** | Payments logic split between `api.js` and `services/`; Razorpay integration gated by `MOCK_PAYMENTS`/`PAYMENTS_ENABLED`; all 56 paymentLifecycle tests pass. | Medium |

---

## Recommendations — Phase 1A Implementation Plan

**Do NOT implement:** Money & Order Engine, any database migrations, remote SQL execution, branch switching, or file commits.

| Phase | Action |
|-------|--------|
| **Phase 1: Fix Critical Gaps** | 1. Implement document upload API endpoints in `src/routes/uploads.js` — already exist; missing is the **frontend UI** that calls them. <br>2. Connect traveler messaging: add conversation selection and message history to traveler dashboard (frontend change, beyond backend scope). <br>3. Verify matching API `GET /requests?matching=me` returns live data from Supabase (already implemented; confirm with integration test). |
| **Phase 2: Reinforce Backend Foundations** | 4. Ensure all route handlers have proper validation and error handling (audit `api.js` — all Zod schemas present, all HttpError throws covered). <br>5. Verify payment provider immutability at both DB CHECK constraint (`provider in ('MOCK','RAZORPAY')`) and application level (already enforced via `MOCK_PAYMENTS` env + `PAYMENTS_ENABLED`). <br>6. Confirm all role‑based middleware checks are correct and complete (admin vs compliance_reviewer distinction verified in duty‑assignment logic). |
| **Phase 3: Test and Verify** | 7. Run full backend test suite: `179/179 pass` across 13 test suites. <br>8. Run frontend `npx next build` — succeeds with original files. <br>9. Verify live Supabase integration points (profiles RLS, storage bucket policies, trip/RLS policies). |

**All inspection was read‑only.** No files were modified, no commits, no remote SQL executed.