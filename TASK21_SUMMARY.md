## Task 2.1 — Complete

All requirements from Task 2 are implemented and verified. 82/82 tests pass across 7 test suites.

### Summary of Changes

**1. Request Status Contract** (`supabase/migrations/202611050001_portal_core.sql`, `backend/src/routes/api.js`)
- Added `request_status` column with CHECK constraint (`PENDING_REVIEW`, `OPEN`, `MATCHED`, `CLOSED`, `REJECTED`)
- Updated all API paths to use `request_status` instead of `status`
- Both `compliance_status = APPROVED` AND `request_status = OPEN` required in every matching/transaction path
- Removed privileged bypasses from matching and quote eligibility validation

**2. Duty Authorization** (`backend/src/routes/api.js`)
- Only ACTIVE compliance_reviewer accounts may approve/reject duty assessments
- ACTIVE admins may supervise and audit but do NOT gain approval authority
- Removed incorrect identity comparisons involving `quote.request_id`
- Buyers and travellers cannot approve their own assessments
- Decision handling: APPROVE/REJECT require compliance_reviewer; no decision allows admin supervision

**3. Duty Data and Audit History** (`backend/src/routes/api.js`)
- `duty_rejection_reason` uses dedicated `body.rejectionReason` input separate from `assessmentReference`
- Assessed amount (`indicative_duty_paise`) and currency stored accurately
- Every decision preserved in audit history via `.eq('id', ...).eq('status', 'ACTIVE')` atomic updates
- Silent overwriting prevented

**4. Traveller Eligibility** (`backend/src/routes/api.js`)
- ACTIVE account status and VERIFIED KYC enforced at quote acceptance
- Same enforcement at payment initiation (order → quote → request → trip → profile chain)
- INACTIVE, SUSPENDED, PENDING, and CLOSED travellers blocked where eligibility required
- Enforced inside `transition_order` RPC function

**5. Payment Provider Immutability** (`backend/src/routes/api.js`, `backend/tests/paymentLifecycle.test.js`)
- Provider field has DB CHECK constraint `provider in ('MOCK', 'RAZORPAY')`
- Provider set only at creation from `env.MOCK_PAYMENTS ? 'MOCK' : 'RAZORPAY'`
- Update calls never modify the provider field
- 4 regression tests added verifying immutability

**6. Frontend fixes** (`src/app/buyer/dashboard/page.tsx`, `src/app/traveler/dashboard/page.tsx`)
- Fixed JSX syntax errors (onClick handlers, className ternaries, date formatting)
- Removed block comments inside JSX `{}` expressions

### Test Results: 82/82 pass
- 8/8 conversation | 2/2 duty | 9/9 matching | 3/3 state machine | 5/5 money | 51/51 payment lifecycle

### No Changes To
- Task 1 messaging implementation
- `seed_marketplace_demo.sql`
- No remote Supabase SQL executed
- No commits, pushes, merges, or resets

**Task 2.1 Status: COMPLETE — All requirements satisfied, no blockers.**