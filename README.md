<<<<<<< HEAD
# Portal

A luxury stays platform with three fully separated workspaces: **Buyer**, **Traveler** and **Admin**.

This repository is a hackathon prototype. Screens are intentionally placeholders; the architecture, routing, design system and mock authentication are in place.

## Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router)             |
| UI         | React 19                            |
| Language   | TypeScript (strict)                 |
| Styling    | Tailwind CSS v4                     |
| Icons      | Lucide React                        |
| Auth       | Auth-agnostic mock (no provider yet)|

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run lint     # ESLint
npm run build    # production build
npm start        # serve the production build
```

## Workspace routes

Every workspace owns a URL prefix, an auth module and a cookie. Nothing is shared.

| Workspace | Sign in            | Register               | Dashboard              |
| --------- | ------------------ | ---------------------- | ---------------------- |
| Buyer     | `/buyer/login`     | `/buyer/register`      | `/buyer/dashboard`     |
| Traveler  | `/traveler/login`  | `/traveler/register`   | `/traveler/dashboard`  |
| Admin     | `/admin/login`     | — (invite only)        | `/admin/dashboard`     |

### Mock credentials

The mock account store seeds one demo account per workspace:

| Workspace | Email                   | Password      |
| --------- | ----------------------- | ------------- |
| Buyer     | `buyer@portal.demo`     | `portal-demo` |
| Traveler  | `traveler@portal.demo`  | `portal-demo` |
| Admin     | `admin@portal.demo`     | `portal-demo` |

> The mock store lives in module memory and resets on server restart. Sessions are base64url-encoded cookies — **not** signed or encrypted. Do not use any of this in production.

## Separation model

- **Routes** — literal `/buyer`, `/traveler`, `/admin` segments, each with its own `layout.tsx`.
- **Cookies** — `portal_buyer_session`, `portal_traveler_session`, `portal_admin_session`, each scoped to its own path (`/buyer`, `/traveler`, `/admin`).
- **Auth modules** — `src/lib/auth/buyer.ts`, `traveler.ts`, `admin.ts` expose workspace-specific `get*Session`, `signIn*`, `signUp*` (Buyer/Traveler only), `signOut*` and `require*Session` functions. There is deliberately no shared “current user” helper.
- **Guard** — `src/lib/auth/session.ts` rejects a session whose `user.workspace` does not match the requested workspace, so a Buyer cookie can never satisfy a Traveler or Admin request.

Swapping the mock for Supabase, Clerk or Auth.js only requires implementing the `AuthAdapter` contract in `src/lib/auth/types.ts`.

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx              root layout, fonts, metadata
│  ├─ page.tsx                landing / workspace chooser
│  ├─ globals.css             design tokens + base typography
│  ├─ not-found.tsx
│  ├─ buyer/                  /buyer/*
│  ├─ traveler/               /traveler/*
│  └─ admin/                  /admin/*
├─ components/
│  ├─ shared/                 brand mark, workspace badge, placeholder shell
│  └─ ui/                     design-system primitives (to come)
├─ hooks/                     client hooks (to come)
├─ lib/
│  ├─ auth/                   types, mock store, session transport, per-workspace APIs
│  ├─ utils.ts                cn() helper
│  └─ workspaces.ts           single source of truth for paths and cookies
└─ types/                     shared domain types (to come)
```

## Design direction

Luxury black, champagne gold and cream. Tokens are defined once in `src/app/globals.css`:

- `--obsidian` / `--obsidian-soft` — near-black surfaces
- `--gold` / `--gold-strong` / `--gold-soft` — champagne accents
- `--background`, `--surface`, `--surface-muted` — cream canvas
- Typography: Geist Sans for UI, a serif stack for display headings, uppercase gold eyebrows for section labels

Use the semantic utilities (`bg-surface`, `text-gold`, `border-border`, `font-serif`, `eyebrow`) instead of raw hex values.

## Not built yet

- Sign-in and registration forms (mock auth functions are ready to call)
- Buyer, Traveler and Admin dashboards
- Route protection enforcement (guards exist but redirects are not wired into requests)
- Per-workspace visual differentiation beyond the header label
=======
# PORTAL Backend — secure MVP foundation

This repository is the first backend implementation slice for Portal. It is a development foundation, not a production payment/escrow system and not a determination that carrying third-party goods in passenger baggage is lawful.

## What is implemented

- Express API on Node.js 22.
- Supabase Auth token verification on the server.
- Server-side roles and account/KYC checks.
- Supabase PostgreSQL schema and RLS policies for profiles, trips, requests, quotes, orders, payment intents, webhooks, OTP challenges, audit events and the ledger.
- Compliance gate: passenger-baggage requests for another person are `REVIEW_REQUIRED`, cannot be matched, and cannot be paid for until a reviewer approves a lawful route.
- FX conversion using integer minor units and a six-decimal fixed-point rate; no JavaScript floating-point money calculations.
- A shared order state machine plus a database-side row-locked transition function.
- Initial deposit calculation (current default: 25%) and platform fee calculation (current default: 5%). These are configuration defaults, not signed commercial terms.
- Demo payment intent flow. No money is collected in mock mode.
- Razorpay adapter, checkout-signature validation and raw-body webhook signature verification, but real payment mode is disabled by default.
- Append-only, balanced ledger posting function with idempotency keys.
- OTP generation/hash/verification primitives using HMAC and timing-safe comparison.
- 15-minute initial payment deadline and 72-hour post-arrival handover deadline job.
- Unit tests for state transitions, money, FX, legal gate, ledger and OTP.

## Explicitly not implemented / not approved

1. No legally approved escrow account, money custody or payouts to travellers.
2. No live FX-rate provider. The `.env.example` FX rates are labelled demo configuration and must never be used to make a real purchase.
3. No customs tariff engine. The platform refuses to accept a quote until duty is manually reviewed and recorded by the compliance process.
4. No production KYC vendor. `/kyc/submit` records `SUBMITTED` only. It never marks a user `VERIFIED`.
5. No shipment/courier integration, GST invoicing, consumer policy, refund engine or production dispute adjudication.
6. No legal conclusion about third-party goods in passenger baggage. Get written advice from an Indian customs professional and payment/regulatory counsel before opening the marketplace.

## Requirements

- Node.js 22 or later
- A Supabase project
- npm

## Local setup (Windows PowerShell)

```powershell
# Extract the ZIP into your chosen project folder first.
cd D:\Projects\PORTAL\portal-backend
Copy-Item .env.example .env
notepad .env
npm install
npm test
npm run dev
```

The server listens on `http://localhost:4000` by default. Health check:

```powershell
Invoke-RestMethod http://localhost:4000/api/v1/health
```

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/migrations/202611050001_portal_core.sql` once.
3. In Project Settings → API, copy the project URL and the **service_role** key into the backend `.env` only.
4. Never place `SUPABASE_SERVICE_ROLE_KEY` in Meghana's frontend `.env`, browser code, GitHub, screenshots or Postman shared environments.
5. The frontend may use the Supabase anon/publishable key for Auth only. All privileged writes must go through this backend.

### Bootstrap a development admin

Create a user through Supabase Auth, then use SQL Editor once to assign the first admin. Replace the UUID with the actual Auth user UUID:

```sql
update public.profiles
set role = 'admin', account_status = 'ACTIVE'
where id = 'YOUR_AUTH_USER_UUID';
```

Do this only in the development project. A production admin must use controlled provisioning, MFA and documented access approval.

For a local-only demo, a reviewer can activate a test buyer or traveller after reviewing the test account. Never manually set `kyc_status='VERIFIED'` for a real person without completing the selected KYC process and recording its provider reference.

## Environment settings

| Variable | Purpose | Default |
|---|---|---|
| `MOCK_PAYMENTS` | Simulated payment intent; never transfers money | `true` |
| `PAYMENTS_ENABLED` | Explicit gate for real payment provider calls | `false` |
| `PLATFORM_FEE_BPS` | Platform fee, basis points (500 = 5%) | `500` |
| `BUYER_DEPOSIT_BPS` | Initial buyer deposit (2500 = 25%) | `2500` |
| `ORDER_PAYMENT_TTL_MINUTES` | Buyer payment window after accepting quote | `15` |
| `FX_RATE_TABLE_JSON` | Server-side demo rates only | Example JSON |
| `OTP_PEPPER` | HMAC secret for OTP hashes | Development placeholder |

For production, load secrets from the host's secret manager. Do not commit `.env`. Do not use the sample FX rates. A production FX provider must return a provider timestamp, currency pair, rate, and source identifier; the quote must be frozen with an explicit expiry and never silently repriced.

## Demo flow / important blockers

The following approvals are deliberate. The marketplace remains closed unless all checks pass.

1. Sign up users with Supabase Auth. The database trigger creates every account as a `buyer` with `PENDING` account status; client metadata cannot self-assign role or KYC state.
2. An active admin provisions the account through `POST /api/v1/admin/profiles/:id/role` with `{\"role\":\"buyer\"}` or `{\"role\":\"traveller\"}`. Traveller accounts stay `PENDING` until KYC is approved. Privileged admin/reviewer roles are bootstrapped out of band and cannot be assigned by this endpoint.
3. Finish real KYC outside the demo stub. The demo `/api/v1/kyc/submit` is not verification. An admin records the provider decision using `/api/v1/admin/profiles/:id/kyc-review`.
4. A compliance reviewer must review the request, HS classification, restricted-goods checks and lawful import channel before changing it to `APPROVED` and `OPEN` using `POST /api/v1/admin/requests/:id/review`.
5. The traveller must have verified KYC and an active trip. A platform admin activates the trip using `POST /api/v1/admin/trips/:id/activate`.
6. Traveller creates a quote. The FX rate is taken from server configuration, not from client input. The included rates are static demonstration values, not live market rates; quote acceptance is blocked until the duty amount is reviewed and recorded by the trusted compliance workflow.
7. Buyer accepts an eligible quote. The backend atomically creates one `ACCEPTED` order and sets a 15-minute payment deadline.
8. Buyer creates a payment intent using `POST /api/v1/payments/create-order` with an `Idempotency-Key` header. In mock mode this does not collect money.
9. In development only, mock verification moves the order to `LOCKED`. This is a simulation; do not tell a user that funds are held or protected.
10. The traveller reports `PURCHASED`, then `LANDED`. The system sets a 72-hour handover deadline. The buyer reports `COMPLETED`, or an overdue landed order enters `FORFEITED` through the expiry job. A disputed order is held for manual resolution; its business meaning and any forfeiture/refund waterfall require a signed policy.

## Run the 72-hour / payment-window expiry job

Run manually:

```powershell
npm run expire-orders
```

Deploy it as a Render Cron Job on a 1–5 minute schedule. The job is safe to retry because transitions are checked in PostgreSQL. It skips unresolved live Razorpay intents for manual reconciliation; it never auto-expires a live payment that might still be captured. Do not expose a public `/admin/expire-now` route in production.

## API routes (v1)

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Health check |
| GET | `/api/v1/config` | Public | Public feature flags |
| GET | `/api/v1/me` | Authenticated | Current profile |
| GET | `/api/v1/fx/convert?amountMinor=10000&from=USD` | Authenticated | Indicative fixed-point conversion to INR |
| POST | `/api/v1/requests` | Buyer | Create request; starts in compliance review |
| GET | `/api/v1/requests/mine` | Buyer | List own requests |
| GET | `/api/v1/requests?matching=me` | Verified traveller | Find approved exact-route matches |
| POST | `/api/v1/trips` | Verified traveller | Create draft trip |
| GET | `/api/v1/trips/mine` | Traveller | List own trips |
| POST | `/api/v1/requests/:id/quotes` | Verified traveller | Create quote using server FX rate |
| GET | `/api/v1/requests/:id/quotes` | Request participant/reviewer | List request quotes |
| POST | `/api/v1/quotes/:id/accept` | Buyer | Atomically accept an eligible quote |
| POST | `/api/v1/payments/create-order` | Buyer | Create idempotent payment intent |
| POST | `/api/v1/payments/verify` | Buyer | Verify mock or provider payment |
| GET | `/api/v1/orders/:id` | Order participant | Get order and state history |
| POST | `/api/v1/orders/:id/purchased` | Assigned traveller | Mark purchased |
| POST | `/api/v1/orders/:id/landed` | Assigned traveller | Mark arrived |
| POST | `/api/v1/orders/:id/handover` | Buyer | Confirm handover/completion |
| POST | `/api/v1/orders/:id/dispute` | Order participant | Open dispute |
| POST | `/api/v1/kyc/submit` | Authenticated | Demo submission only |
| POST | `/api/v1/admin/requests/:id/review` | Compliance reviewer/admin | Approve/reject legal route |
| POST | `/api/v1/admin/quotes/:id/duty-assessment` | Compliance reviewer/admin | Attach reviewed duty figure and source |
| POST | `/api/v1/admin/trips/:id/activate` | Admin | Activate cleared trip |
| POST | `/api/v1/admin/profiles/:id/role` | Admin | Assign buyer/traveller role; buyer activates, traveller requires KYC |
| POST | `/api/v1/admin/profiles/:id/kyc-review` | Admin | Record KYC provider decision transactionally with audit |
| POST | `/api/v1/webhooks/razorpay` | Razorpay signature | Raw-body webhook receiver |

All error responses use:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human-readable message",
    "requestId": "trace-id"
  }
}
```

## Security baseline

- HTTPS is mandatory in production; configure TLS at the host/load balancer.
- Use exact frontend origins in `APP_ORIGINS`; no wildcard CORS.
- Keep Supabase service-role, Razorpay secret, webhook secret and OTP pepper in server secrets only.
- Require Supabase Auth on protected routes and check server-side roles/account status.
- Enable MFA for admins and reviewers in Supabase Auth; provision privileged roles out of band.
- Keep all ledger and order events append-only; corrections are compensating entries, not edits.
- Use unique idempotency keys for payment creation and unique provider event IDs for webhook replay protection.
- Verify Razorpay webhook HMAC over exact raw bytes and validate captured amount/currency/order against the server record.
- Do not store card numbers, CVV, bank passwords, raw OTPs, passport scans or KYC documents in application tables.
- Store any required identity documents in a private, access-controlled object store through a verified KYC provider; short-lived signed URLs only.
- Keep data collection minimal, define retention/deletion workflows and prepare privacy notices/consent before production. The DPDP Rules, 2025 include security safeguards such as encryption/masking, access control, monitoring, backups and breach response; applicability/commencement must be reviewed against the current phased timeline.
- Log security events without secrets, OTP values, access tokens, payment credentials or unmasked sensitive documents.
- Add automated dependency scanning, secret scanning, SAST, database backup/restore drills and an independent penetration test before launch.

## Financial and legal sign-off still required

- The 5% fee and 25% deposit are configurable draft values; reconcile the original spec examples and refund rules.
- Decide the exact release/refund/forfeit waterfall with a lawyer and the payment provider.
- Confirm whether the chosen payment arrangement is domestic PA, PA-CB, a marketplace split-settlement product, or another regulated flow. Obtain written confirmation from the payment provider and counsel.
- Confirm the import model: passenger baggage is not a shortcut for commercial third-party imports. Consider formal import/courier with an importer of record and customs broker.
- Build correct HS classification, product restrictions, valuation, country-specific import permission, customs duty/tax and invoice process with qualified advice.
- Document GST, consumer protection, platform intermediary, grievance, refund, dispute, accounting and tax obligations.

## Tests

```powershell
npm test
```

The tests are unit tests for deterministic services. Before a production release, add integration tests against a disposable Supabase project, webhook replay tests, concurrent quote/payment tests, RLS tests using anon/authenticated/service-role tokens, load tests and end-to-end abuse cases.
>>>>>>> cb3685cd4cf63eec7590c45488360f154886747e
