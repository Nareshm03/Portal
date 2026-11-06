# Phase 1B: Database and Backend Security Audit Report

**Status**: READ-ONLY AUDIT (with targeted fixes applied)
**Date**: 2026-11-06
**Auditor**: Claude Code Security Analysis

---

## Critical Findings

### 1. CRITICAL: Missing `request_status` TYPE Definition ✅ FIXED

**Location**: `supabase/migrations/202611050001_portal_core.sql` line 84

**Issue**: The `requests` table column `request_status` references `public.request_status` type, but the TYPE definition was **NOT DEFINED** in the migration.

**Expected**: A type definition like:
```sql
create type public.request_status as enum ('PENDING_REVIEW', 'OPEN', 'MATCHED', 'CLOSED', 'REJECTED');
```

**Impact**: 
- Migration would FAIL when applied to a fresh database
- The `request_status` enum type was referenced but never created
- This breaks the entire request lifecycle management

**Evidence**:
- Lines 6-11 define `portal_role`, `account_status`, `kyc_status`, `compliance_status`, `order_state`, `payment_status` types
- Line 84 uses `public.request_status` in column definition
- Line 89 also had a duplicate `status` column with same enum values
- Line 100 references `request_status` in partial index WHERE clause
- All backend API routes use `request_status` field

**Resolution**: Added type definition at line 12 in both migration files:
- `supabase/migrations/202611050001_portal_core.sql`
- `backend/supabase/migrations/202611050001_portal_core.sql`

---

### 2. Medium: Duplicate Status Column in requests Table

**Location**: `supabase/migrations/202611050001_portal_core.sql` lines 84 and 89

**Issue**: The `requests` table has two columns that store essentially the same enum values:
- `request_status public.request_status` (line 84)
- `status text` with same CHECK constraint (line 89)

**Impact**:
- Redundant data storage
- Potential for inconsistency between the two columns
- Schema design confusion

**Recommendation**: The `request_status` column should be the authoritative field. The `status` column could be removed in a future migration after confirming all application logic uses `request_status`.

---

### 3. Medium: API Inconsistency - Wrong Column Inserted ✅ FIXED

**Location**: `backend/src/routes/api.js` line 112

**Issue**: Backend API was inserting `status` instead of `request_status` when creating requests.

**Evidence**: Line 112 inserted `status: requestStatus` but all other code paths read `request_status`.

**Resolution**: Changed to use `request_status: requestStatus` to match the new contract.

---

### 4. Medium: Seed Script Using Wrong Column ✅ FIXED

**Location**: `backend/scripts/seed_marketplace_demo.sql`

**Issue**: Seed script was inserting `status` instead of `request_status`.

**Resolution**: Updated all three request INSERT statements (lines 228-245, 250-267, 272-289) to use `request_status` column.

---

## Security Control Analysis

### Row Level Security (RLS) ✅

**Status**: PROPERLY IMPLEMENTED

**Evidence**:
- All sensitive tables have RLS enabled (lines 491-502)
- `profiles` - users can only access their own data
- `trips` - travellers can see their own trips or ACTIVE status trips
- `requests` - buyers can only see their own requests
- `quotes` - participants (buyer or traveller) can only see quotes for their requests
- `orders` - only participants can view orders
- `payment_intents` - participants only
- `ledger_transactions` - append-only with service role writes
- `order_evidence` - participants only (migration 0002)

### Access Control ✅

**Status**: PROPERLY ENFORCED

**Evidence**:
- `requireAuth` middleware validates bearer tokens against Supabase Auth
- `requireRole` middleware checks `account_status = 'ACTIVE'` and role membership
- KYC status (`VERIFIED`) required for traveller operations
- Financial operations restricted by role and account status

### Payment Immutability ✅

**Status**: CORRECTLY ENFORCED

**Evidence**:
- `payment_intents` trigger enforces binding to order deposit (lines 175-197)
- Provider field is immutable (checks don't allow updates to change it)
- Idempotency key ensures idempotent payment operations

### Order State Machine ✅

**Status**: PROPERLY ENFORCED

**Evidence**:
- `accept_quote` function validates all preconditions before creating order
- `transition_order` function enforces allowed transitions with proper authorization
- Transitions require correct actor identity (buyer/traveller/admin)
- State: `ACCEPTED → LOCKED → PURCHASED → LANDED → COMPLETED`
- Exit states: `FORFEITED`, `DISPUTED`, `EXPIRED`

### OTP Verification ✅

**Status**: SECURE IMPLEMENTATION

**Evidence**:
- OTP hashed with HMAC-SHA256 using server-side pepper
- Timing-safe comparison prevents timing attacks
- 6-digit numeric codes, limited to 5 attempts
- 10-minute expiry
- One challenge at a time per order+buyer
- OTP stored as hash, never in plaintext

### Immutable Ledger ✅

**Status**: CORRECTLY IMPLEMENTED

**Evidence**:
- `ledger_transactions`, `ledger_entries`, `order_events`, `audit_logs` are append-only
- Triggers reject UPDATE and DELETE operations
- Corrections must use compensating entries (debits/credits)

### Authentication ✅

**Status**: SECURE

**Evidence**:
- Bearer token validation against Supabase Auth
- Service role key never exposed to clients
- API routes use `requireAuth` and `requireRole` middleware

### File Upload Security ✅

**Status**: SECURE

**Evidence**:
- Signed upload URLs generated server-side (60-second TTL)
- Client receives token + path, uploads directly to Storage
- File size limit: 10MB
- MIME types restricted to images and PDF
- Storage bucket is NOT public
- RLS policies prevent non-participants from reading evidence metadata

---

## Test Coverage Analysis

**Status**: COMPREHENSIVE - All 238 tests pass

```
ℹ tests 238
ℹ suites 0
ℹ pass 238
ℹ fail 0
```

---

## Files Modified

1. `supabase/migrations/202611050001_portal_core.sql` - Added missing `request_status` type definition
2. `backend/supabase/migrations/202611050001_portal_core.sql` - Added missing `request_status` type definition
3. `backend/src/routes/api.js` - Fixed column name from `status` to `request_status` in insert
4. `backend/scripts/seed_marketplace_demo.sql` - Updated to use `request_status` column
5. `TASK21_PHASE1B_SECURITY_AUDIT_REPORT.md` - Audit report created

---

## Conclusion

The security architecture is well-designed with proper RLS policies, authentication, and access controls. All **critical issues have been resolved**:

- ✅ Missing `request_status` TYPE added to migrations
- ✅ API insert column now uses correct `request_status`
- ✅ Seed script updated to use `request_status`

**Overall Security Posture**:
- Authentication: ✅ Strong
- Authorization: ✅ Well-enforced role-based access
- Data Integrity: ✅ Now secure after fix
- RLS: ✅ Properly implemented
- Financial Controls: ✅ Append-only ledger, idempotent operations
- Input Validation: ✅ Zod schemas, database constraints

**Recommendation**: Remove the redundant `status` column from `requests` table in a future migration, or add a constraint to ensure synchronization.