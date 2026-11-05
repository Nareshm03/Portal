# Portal implementation status

This is a first backend foundation, not a production-ready marketplace.

## Implemented in this starter

- Express API bootstrap, request IDs, structured redacted logging, exact-origin CORS, Helmet, request-size limits and rate limiting.
- Supabase Auth token verification and server-side profile/role/account checks.
- Admin-only buyer/traveller provisioning and transactional KYC decision audit functions.
- Request, trip and quote creation/listing with exact route/date matching.
- Compliance review gates; third-party goods cannot be approved under passenger-baggage fulfilment.
- Server-configured FX conversion with integer minor units and fixed-point arithmetic. Sample rates are demo-only.
- Order quote acceptance via a row-locked PostgreSQL function.
- Central state machine enforced in application code and PostgreSQL.
- Mock payment intents, Razorpay adapter, checkout/webhook signature verification, amount binding and idempotent webhook records.
- Append-only ledger schema and balanced/idempotent ledger posting RPC (not yet wired to an end-to-end funds flow).
- HMAC OTP hashing/verification primitives and an OTP challenge table (no delivery/verification API yet).
- Payment expiry and landed-order forfeit job with protection against auto-expiring unresolved live provider payments.
- Unit tests for money, FX, duty gate, ledger validation, OTP hashing and state transitions.

## Not implemented or not verified yet

- The real frontend and its integration with Meghana's branch.
- Live FX provider, signed rate timestamps, stale-rate rejection and spread policy.
- Automated HS classification, destination-specific duty/tax engine, customs broker workflow or legal approval.
- Production KYC vendor, document capture, data retention and verified provider webhooks.
- Production payment capture/release, split settlement, payouts, partial/full refunds, reversals and daily reconciliation.
- Regulated escrow or custody. The internal ledger is not a bank account or an escrow service.
- Full OTP issuance, secure delivery, attempt/expiry workflow and handover verification endpoint.
- Chat, Supabase Realtime authorization, file uploads/storage policies and notifications.
- Admin dispute resolution, support tooling and final forfeiture/refund policy.
- Database migration execution, PostgreSQL integration tests, RLS tests, load tests and penetration testing.

## Verification performed in this environment

- Node.js syntax checks passed for every JavaScript file.
- `npm test`: 13 tests passed, 0 failed.
- Dependencies could not be restored in this environment, so the Express process was not started end-to-end.
- No Supabase project credentials or local PostgreSQL/Supabase CLI were available. The SQL migration has not been applied or executed here.
