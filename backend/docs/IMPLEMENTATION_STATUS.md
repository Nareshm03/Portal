# Portal implementation status

This is a first backend foundation, not a production-ready marketplace.

## Implemented in this starter

- Express API bootstrap, request IDs, structured redacted logging, exact-origin CORS, Helmet, request-size limits and rate limiting.
- Supabase Auth token verification and server-side profile/role/account checks.
- Admin-only buyer/traveller provisioning and transactional KYC decision audit functions.
- Request, trip and quote creation/listing with exact route/date matching.
- Compliance review gates; third-party goods cannot be approved under passenger-baggage fulfilment.
- Server-configured FX conversion with integer minor units and fixed-point arithmetic. Sample rates are demo-only.
- Order quote acceptance via a row-locked PostgreSQL function. Quotes carry a traveller-entered reward that is frozen verbatim on acceptance; the platform fee and commitment deposit are computed on the product cost only (excluding duty), and the upfront collection (deposit + duty + platform fee) is what is charged and locked.
- Central state machine enforced in application code and PostgreSQL.
- Mock payment intents, Razorpay adapter, checkout/webhook signature verification, upfront-amount binding and idempotent webhook records.
- Append-only ledger schema with balanced/idempotent posting RPC, now wired to the funds flow: a collection journal posts on order lock and a settlement journal posts on OTP-verified completion.
- OTP issuance and verification endpoints with attempt limiting and expiry; the code is returned only in demo mode (in production it is delivered to the buyer out-of-band). Handover completion is OTP-gated.
- Payment expiry and landed-order forfeit job with protection against auto-expiring unresolved live provider payments. The job accepts an injectable Supabase client and server time for unit testing, handles one failed order without stopping the rest, and uses the row-locked transition_order RPC for idempotent transitions.
- Payment and transaction lifecycle reliability: duplicate payment verify now posts the collection ledger idempotently; quote acceptance verifies buyer ownership, duty approval, quote expiry, and no double acceptance; payment intents bind to upfront collection amount with idempotency-key protection; webhooks reject invalid signatures, duplicate event IDs with different payloads, wrong amounts/currencies, and unknown provider orders; ledger collection and settlement use idempotency keys and compensating entries only; OTP is scoped to order+buyer with attempt limiting and expiry.
- Unit tests for money (including the rule-accurate order breakdown), FX, duty gate, ledger validation, OTP hashing and state transitions, plus expiry job tests and payment lifecycle tests covering quote acceptance, payment intent reliability, webhook reliability, ledger reliability, OTP/order lifecycle, and complete mock transaction journey.

## Not implemented or not verified yet

- The real frontend and its integration with Meghana's branch.
- Live FX provider, signed rate timestamps, stale-rate rejection and spread policy.
- Automated HS classification, destination-specific duty/tax engine, customs broker workflow or legal approval.
- Production KYC vendor, document capture, data retention and verified provider webhooks.
- Production payment capture/release, split settlement, payouts, partial/full refunds, reversals and daily reconciliation.
- Regulated escrow or custody. The internal ledger is not a bank account or an escrow service.
- Secure out-of-band OTP delivery (SMS/email) — the demo returns the code in the API response; production delivery is not implemented.
- Chat, Supabase Realtime authorization, file uploads/storage policies and notifications.
- Admin dispute resolution, support tooling and final forfeiture/refund policy.
- Database migration execution, PostgreSQL integration tests, RLS tests, load tests and penetration testing.

## Verification performed in this environment

- Node.js syntax checks passed for every JavaScript file.
- `npm run check`: 223 tests passed, 0 failed (Node's built-in test runner). Unit tests cover money (including the rule-accurate order breakdown), FX, duty gate, ledger validation, OTP hashing and state transitions, expiry job tests, payment lifecycle tests, and route-level tests exercising the real Express handlers with an injected fake Supabase client. Route-level tests now pass reliably, including chained query-builder operations, nested `requests(*)` relations, and async RPC side effects.
- Dependencies restored successfully; tests run with Node's built-in test runner.
- No Supabase project credentials or local PostgreSQL/Supabase CLI were available. The SQL migration has not been applied or executed here. All tests use injected fake Supabase clients — no live database verification.
