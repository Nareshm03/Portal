# Task 26: Payment Dispute & Chargeback Management Engine

**Module:** Portal Backend Payment Dispute & Chargeback Engine  
**Status:** Complete  
**Environment:** Test & Sandboxed Demo (No real financial operations, no live Razorpay calls)  
**Verification:** `npm run check` (Node syntax check + 498 tests passed)

---

## 1. Executive Summary

Task 26 implements an end-to-end payment dispute and chargeback backend system for Portal. The engine supports:
- Persistent dispute records linked directly to `orders` and `payment_intents`.
- A 6-state lifecycle aligned with payment networks: `CREATED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `WON`, `LOST`, `CLOSED`.
- Webhook ingestion for all Razorpay dispute events using existing raw-body HMAC verification and idempotent deduplication.
- Out-of-order and duplicate webhook protection that maintains state machine invariants without corrupting records.
- Strict financial safeguards preventing order settlement while an unresolved dispute exists and blocking conflicting refund attempts unless explicitly authorized by an approved policy override.
- Double-entry ledger integrity guaranteeing that ledger entries are append-only and never mutated. When a dispute is confirmed lost, a balanced `DISPUTE_LOST` reversal is posted (`ESCROW_HOLD` debited, `DISPUTE_LOSS` credited) with idempotency protections.
- Reconciliation checks verifying dispute amounts against captured payment intents.
- Secure evidence management leveraging Supabase Storage with signed download URLs restricted to authorized order participants and administrators.
- Comprehensive administrative inspection endpoints providing timelines, financial impact, evidence tracking, and deadlines without exposing sensitive personal info or raw payloads. No automated contesting or accepting of disputes is performed.

---

## 2. Database Migrations & Application Schema

### Migration File: `backend/supabase/migrations/202611060002_disputes.sql`

The migration defines persistent dispute entities and access control rules:

1. **Custom Enums:**
   - `public.dispute_status`: `'CREATED'`, `'UNDER_REVIEW'`, `'ACTION_REQUIRED'`, `'WON'`, `'LOST'`, `'CLOSED'`
   - `public.dispute_reason`: `'DUPLICATE'`, `'FRAUD'`, `'INCORRECT_AMOUNT'`, `'PRODUCT_NOT_RECEIVED'`, `'PRODUCT_NOT_AS_DESCRIBED'`, `'CANCELLED_ORDER'`, `'REFUND_NOT_PROCESSED'`, `'OTHER'`

2. **Tables:**
   - **`public.disputes`**:
     - `id uuid primary key default gen_random_uuid()`
     - `order_id uuid not null references public.orders(id) on delete cascade`
     - `payment_intent_id uuid references public.payment_intents(id) on delete set null`
     - `provider text not null check (provider in ('RAZORPAY', 'MOCK'))`
     - `provider_dispute_id text`
     - `provider_payment_id text`
     - `provider_order_id text`
     - `amount_paise bigint not null check (amount_paise > 0)`
     - `currency char(3) not null default 'INR' check (currency = 'INR')`
     - `reason public.dispute_reason not null`
     - `status public.dispute_status not null default 'CREATED'`
     - `evidence_deadline timestamptz`
     - `evidence_submitted_at timestamptz`
     - `resolved_at timestamptz`
     - `resolution_note text`
     - `metadata jsonb not null default '{}'::jsonb`
     - `created_at timestamptz not null default now()`
     - `updated_at timestamptz not null default now()`
     - `constraint dispute_provider_dispute_id_unique unique (provider, provider_dispute_id)`
   - **`public.dispute_events`**:
     - Immutable audit trail tracking every transition: `dispute_id`, `from_status`, `to_status`, `event_type`, `actor_id`, `note`, `metadata`, `created_at`.
   - **`public.dispute_evidence`**:
     - Evidence document metadata: `dispute_id`, `storage_path`, `original_filename`, `mime_type`, `size_bytes`, `uploaded_by`, `description`, `created_at`.

3. **Triggers and Security:**
   - `enforce_dispute_transition()`: PL/pgSQL validation trigger enforcing legal state transitions on `dispute_events`.
   - `set_dispute_updated_at()`: Automatically refreshes `updated_at` timestamps on modification.
   - Row Level Security (RLS) enabled on `disputes`, `dispute_events`, and `dispute_evidence`.
   - Select policies allow only authenticated order participants (buyer, traveller) and active platform admins (`role = 'admin'` and `account_status = 'ACTIVE'`).
   - Strict service-role grants: `service_role` possesses write authority; clients cannot insert/update directly.

---

## 3. Supported Webhook Events & Lifecycle Engine

The Razorpay webhook handler in `backend/src/routes/webhooks.js` was extended to ingest dispute events using the existing HMAC-SHA256 signature verification over raw body bytes:

| Razorpay Webhook Event | Target Status | Triggered Actions |
|---|---|---|
| `dispute.created` / `payment.dispute.created` | `CREATED` | Validates dispute minor units; reconciles against captured payment amount; creates persistent dispute record; logs audit event in `dispute_events`; transitions order to `DISPUTED` via `transition_order` RPC. |
| `dispute.under_review` | `UNDER_REVIEW` | Transitions dispute status; updates evidence deadline if provided; logs audit event. |
| `dispute.action_required` | `ACTION_REQUIRED` | Transitions dispute status; notifies deadline; logs audit event. |
| `dispute.won` | `WON` | Confirmed merchant win; sets `resolved_at`; updates status to `WON`; records win event; escrow funds remain intact. |
| `dispute.lost` | `LOST` | Confirmed chargeback loss; sets `resolved_at`; updates status to `LOST`; posts double-entry balanced `DISPUTE_LOST` ledger transaction (`ESCROW_HOLD` DEBIT, `DISPUTE_LOSS` CREDIT); idempotent key `dispute:lost:<disputeId>`. |
| `dispute.closed` | `CLOSED` | Terminal state; sets `resolved_at`; updates status to `CLOSED`; logs audit event. |

### Webhook Safety Guarantees
- **Duplicate Protection:** Webhook events are idempotently stored with SHA-256 payload hashes. Reused event IDs return `{ received: true, duplicate: true }`.
- **Out-of-Order Safety:** If a delayed event arrives for an earlier state (e.g., `dispute.under_review` arriving after `dispute.lost`), `VALID_TRANSITIONS` rejects the invalid rollback; the status update is safely skipped and logged without corrupting database integrity.
- **Tamper Protection:** Mismatched payload hashes on identical event IDs return `409 WEBHOOK_EVENT_MISMATCH`. Missing event IDs return `400 EVENT_ID_REQUIRED`. Bad signatures return `401 INVALID_WEBHOOK_SIGNATURE`.

---

## 4. Financial Safeguards & Ledger Integrity

1. **Settlement Blocking:**
   - Evaluated in `checkSettlementBlock()` and enforced in `apiRouter.post('/orders/:id/handover/verify')`.
   - If an order has an active dispute (`CREATED`, `UNDER_REVIEW`, `ACTION_REQUIRED`), handover verification and order completion are blocked with `409 DISPUTE_ACTIVE_SETTLEMENT_BLOCKED`.
2. **Refund Conflict Prevention:**
   - Evaluated in `checkRefundConflict()` and enforced in `POST /orders/:id/cancel` and `POST /refunds/create`.
   - Active disputes block new refund requests with `409 REFUND_DISPUTE_CONFLICT`.
   - Allowed only when an approved policy override is provided (`policyOverride: true`).
3. **Double-Entry Balanced Ledger:**
   - Never modifies existing ledger rows.
   - On confirmed provider loss (`dispute.lost`), `postDisputeLostLedger()` posts a balanced journal:
     - `ESCROW_HOLD`: DEBIT `amount_paise`
     - `DISPUTE_LOSS`: CREDIT `amount_paise`
   - Uses idempotency key `dispute:lost:${disputeId}` to guarantee exactly-once posting.
4. **Reconciliation Checks:**
   - Added `checkDisputeReconciliation()` in `backend/src/services/reconciliation.js`.
   - Flags `DISPUTE_AMOUNT_MISMATCH` if dispute amount exceeds the captured payment amount.
   - Re-verifies `checkDisputedOrderSettlement()` ensuring no disputed order ever has an `ORDER_SETTLED` ledger transaction.

---

## 5. Evidence & Administrative API Endpoints

All admin endpoints require `requireAuth` and `requireRole('admin')`:

| Endpoint | Method | Description | Security Controls |
|---|---|---|---|
| `/api/v1/admin/disputes` | `GET` | Paginated listing of disputes with filters (`status`, `orderId`, `provider`, `from`, `to`). | Sensitive fields redacted via `redactSensitive()`. |
| `/api/v1/admin/disputes/:disputeId` | `GET` | Complete dispute dossier including timeline, financial impact, deadline, and attached evidence. | Raw webhook payloads and secrets omitted; no automated accept/contest execution. |
| `/api/v1/admin/disputes/:disputeId/evidence` | `POST` | Links uploaded evidence document to dispute record and writes `EVIDENCE_SUBMITTED` audit event. | Validates MIME type, positive file size, and storage path. |
| `/api/v1/admin/disputes/:disputeId/evidence/:evidenceId/download` | `GET` | Issues short-lived signed download URL (TTL 60s) from private Supabase Storage bucket. | Access restricted to active admins and order participants. |
| `/api/v1/orders/:id/disputes` | `GET` | Participant view of disputes for a given order. | Restricted to buyer or traveller assigned to the order. |
| `/api/v1/disputes/:disputeId/evidence/:evidenceId/download` | `GET` | Participant evidence download endpoint. | Verifies caller is assigned buyer or traveller before generating signed URL. |

---

## 6. Exact Test Results

Ran full check suite using `npm run check` (`node --check src/index.js && node --test --test-concurrency=1`):

```
> portal-backend@0.1.0 check
> node --check src/index.js && node --test --test-concurrency=1

✔ production: missing SUPABASE_URL throws (224.1389ms)
✔ production: non-HTTPS SUPABASE_URL throws (371.7301ms)
✔ production: missing SUPABASE_SERVICE_ROLE_KEY throws (243.7713ms)
✔ production: weak OTP pepper (under 32 chars) throws (208.9907ms)
✔ production: development-only OTP pepper throws (308.1373ms)
✔ production: MOCK_PAYMENTS=true throws (183.4722ms)
✔ production: PAYMENTS_ENABLED=true alongside MOCK_PAYMENTS=true throws (215.0909ms)
✔ production: OTP_PROVIDER=mock throws (250.0678ms)
✔ production: OTP_PROVIDER=msg91 without MSG91_AUTH_KEY throws (269.4545ms)
✔ production: OTP_PROVIDER=msg91 without MSG91_OTP_TEMPLATE_ID throws (306.2649ms)
✔ production: valid configuration loads successfully (293.667ms)
✔ development: missing SUPABASE_URL does not throw (314.0662ms)
✔ test: missing SUPABASE_URL does not throw (305.0096ms)
✔ participant authorization only allows the buyer or traveller (3.6198ms)
✔ assertParticipant throws 403 for non-participants (2.6193ms)
✔ clampLimit coerces and bounds the page size (0.4424ms)
✔ shapeMessagePage paginates newest-first with a seq cursor (1.5528ms)
✔ markReadByRecipient flags the caller own messages once the recipient read them (0.5727ms)
✔ computeUnreadCounts counts incoming messages past the read cursor (0.7297ms)
✔ buildConversationList assembles previews, unread counts and the other participant (0.8425ms)
✔ validateMessageBody rejects empty and over-long messages (0.7044ms)
✔ disputes: covers all 6 lifecycle states (2.5921ms)
✔ disputes: every valid lifecycle transition is permitted (0.5007ms)
✔ disputes: invalid lifecycle transitions are strictly rejected (1.6785ms)
✔ disputes: process dispute.created webhook creates persistent record and transitions order (13.4895ms)
✔ disputes: process dispute.won updates status and records audit event (9.0957ms)
✔ disputes: process dispute.lost applies balanced financial reversal ledger (6.6696ms)
✔ disputes: duplicate webhook event ID returns duplicate status idempotently (3.5294ms)
✔ disputes: out-of-order webhook does not corrupt state (e.g. under_review arriving after dispute is LOST) (9.4412ms)
✔ disputes: webhook with invalid signature returns 401 (1.8423ms)
✔ disputes: webhook missing event ID returns 400 (1.6894ms)
✔ disputes: participant endpoints enforce ownership (24.3893ms)
✔ disputes: evidence download URL enforces participant and admin access (20.2432ms)
✔ disputes: settlement is blocked when active dispute is unresolved (6.2392ms)
✔ disputes: refund request is blocked during active dispute unless policy override granted (6.1406ms)
✔ disputes: postDisputeLostLedger creates balanced double-entry and never modifies prior entries (0.8156ms)
✔ disputes: checkDisputeReconciliation flags dispute amounts exceeding captured payment (0.4959ms)
✔ disputes: checkDisputedOrderSettlement flags settled orders that are in dispute (0.2867ms)
✔ disputes: admin GET /admin/disputes lists disputes with sensitive fields redacted (7.714ms)
✔ disputes: admin GET /admin/disputes/:disputeId returns timeline, financial impact & evidence (35.1983ms)
✔ disputes: admin POST /admin/disputes/:disputeId/evidence records evidence and logs audit event (4.9148ms)
...
✔ DISPUTE_STATUSES includes all expected statuses (2.8941ms)
✔ DISPUTE_REASONS includes all expected reasons (0.4301ms)
✔ VALID_TRANSITIONS matches expected state machine (2.8854ms)
✔ TERMINAL_STATUSES only contains CLOSED (1.2367ms)
✔ SETTLEMENT_BLOCKING_STATUSES blocks non-terminal active disputes (0.7396ms)
✔ REFUND_BLOCKING_STATUSES mirrors settlement blocking (0.658ms)
✔ assertDisputeTransition allows valid transitions (0.8091ms)
✔ assertDisputeTransition rejects invalid transitions (1.7143ms)
✔ normalizeDisputeReason maps Razorpay codes correctly (0.6756ms)
✔ validateDisputeData accepts valid data (1.0495ms)
✔ validateDisputeData rejects missing orderId (0.4007ms)
✔ validateDisputeData rejects invalid provider (0.3265ms)
✔ validateDisputeData rejects zero/negative amount (0.331ms)
✔ validateDisputeData rejects unsupported currency (0.2827ms)
✔ validateDisputeData normalizes unknown reason to OTHER (0.2112ms)
✔ checkSettlementBlock returns blocked for active disputes (0.3659ms)
✔ checkSettlementBlock returns not blocked for terminal disputes (0.2817ms)
✔ checkRefundConflict blocks refund for active disputes by default (0.5216ms)
✔ checkRefundConflict allows refund with policy override (0.2003ms)
✔ reconcileDisputeAmount validates dispute <= captured (0.3532ms)
✔ buildDisputeEvent creates valid event record (0.4052ms)
✔ buildDisputeEvent rejects invalid toStatus (3.2268ms)
✔ buildDisputeTimeline merges events and evidence chronologically (32.9456ms)
✔ buildDisputeFinancialImpact computes correct flags (1.082ms)
✔ parseRazorpayDisputeEvent maps dispute.created event (0.8437ms)
✔ parseRazorpayDisputeEvent handles payment.dispute.created (0.4422ms)
✔ parseRazorpayDisputeEvent returns null for non-dispute events (0.1729ms)

ℹ tests 498
ℹ suites 0
ℹ pass 498
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 62256.9905
```

---

## 7. Outstanding Provider & Operational Requirements

1. **Razorpay Dispute API Authorization:**
   - In live production, contest submission and document uploads (`POST /v1/disputes/:id/contest`) require active Razorpay merchant dashboard credentials or Dispute API scopes.
   - Portal strictly adheres to the principle of human-in-the-loop: Portal administrators review evidence and make contest/accept decisions directly on the provider portal or through verified admin actions.
2. **Webhook Endpoint Configuration in Razorpay Dashboard:**
   - In production, register the webhook endpoint URL `https://<api-domain>/api/v1/webhooks/razorpay` in the Razorpay Merchant Dashboard.
   - Subscribe to dispute events:
     - `payment.dispute.created`
     - `payment.dispute.action_required`
     - `payment.dispute.under_review`
     - `payment.dispute.won`
     - `payment.dispute.lost`
     - `payment.dispute.closed`
   - Store the secret in production environment variable `RAZORPAY_WEBHOOK_SECRET`.
3. **Database Migration Application:**
   - Apply `202611060002_disputes.sql` in the Supabase PostgreSQL SQL Editor before enabling dispute webhook processing in staging/production.

