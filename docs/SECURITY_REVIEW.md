# Initial Security Review

## P0 — required before any real user or payment

- Obtain written customs/legal approval for the business model and every supported fulfilment route.
- Obtain payment-provider and regulatory confirmation for funds collection, delayed release, marketplace split settlements, cross-border activity and refunds. Do not represent database records as escrow.
- Implement verified KYC with a production vendor and verified callbacks; no client-side verification flags.
- Replace demo FX table with a reputable licensed/contracted provider. Store source, timestamp, rate precision, expiry and markup; block stale quotes.
- Build real duty/tax computation from validated HS classifications and supported destinations, or require manual compliance decision.
- Implement provider-supported payout, refund and reconciliation flows with maker-checker approval and daily reconciliation.
- Add MFA and restricted admin provisioning, audit reviewer decisions and monitor privileged actions.
- Verify every state/ledger transition using concurrent integration tests against PostgreSQL.
- Confirm DPDP Act/Rules phased commencement and applicable obligations at launch; implement privacy notice, consent, rights, retention, deletion and breach runbooks.

## Implemented controls in this slice

- Server-side Supabase JWT verification.
- Server-owned role, account and KYC fields; admin-only role provisioning and transactional KYC decision audit.
- RLS on all business tables; no direct client write policies for orders, payments, ledger, OTP or audit data.
- Locked SQL state transition function and balanced append-only journal function.
- Unique payment idempotency key; unique provider order/payment/event IDs.
- Exact-origin CORS allowlist, Helmet headers, body-size limits, rate limits and request correlation IDs.
- Payment and webhook HMAC verification primitives using timing-safe comparison.
- Raw-body webhook parsing and provider-event replay detection.
- Integer money and fixed-point FX calculations.
- HMAC OTP hashing, no plaintext OTP persistence, attempt count constraint.
- Redacted structured logging.

## Remaining attack surfaces to test

- Privileged role assignment and admin MFA recovery.
- JWT revocation, expired tokens, disabled users and account takeover.
- Request ID abuse, CORS preflight edge cases, proxy trust configuration and rate-limit bypass through proxies.
- Race conditions: quote accepted concurrently, payment intent retried in parallel, capture webhook racing client verification, repeated refund/reversal.
- Supabase RLS tests with anon/authenticated roles, storage object policies, realtime channel authorization.
- Webhook signature replay, duplicate events, out-of-order events, payload mismatch, amount mismatch and provider API outages. Unresolved provider payment intents are not expired automatically; they need reconciliation.
- Object-level authorization for every endpoint and every query filter.
- SQL injection, PostgREST filter injection, oversized payloads, malicious URLs, SSRF if server-side URL fetching is later introduced.
- Audit log tampering, backups, point-in-time restore and incident response.
