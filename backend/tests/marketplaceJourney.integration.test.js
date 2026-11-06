/**
 * End-to-End Marketplace Journey Integration Tests
 *
 * This test suite covers the complete workflow:
 * Buyer Request → Compliance Review → Traveler Trip → Matching → Quote Submission → Quote Acceptance → Order Engine Handoff
 *
 * Tests are independent and do not require live database.
 * Uses mock Supabase helpers for isolation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockSupabase,
  orderRow,
  intentRow,
  tripRow,
  profileRow,
  future,
  past,
  freshFuture,
  testUuid,
  quoteRow
} from './helpers/mockSupabase.js';
import { createRouteTester, injectDb } from './helpers/routeTester.js';
import { hashOtp } from '../src/services/otp.js';

const rt = createRouteTester();

/* ========================================================================
 * TEST IDENTITIES
 * ======================================================================== */

const BUYER_ID = testUuid(101);
const TRAVELLER_ID = testUuid(102);
const ADMIN_ID = testUuid(103);
const ORDER_ID = testUuid(105);
const QUOTE_ID = testUuid(106);
const REQUEST_ID = testUuid(107);
const TRIP_ID = testUuid(108);
const INTENT_ID = testUuid(109);

function buyerToken() { return `Bearer ${BUYER_ID}-token`; }
function travellerToken() { return `Bearer ${TRAVELLER_ID}-token`; }

/* ========================================================================
 * SECTION A: Buyer Request Workflow
 * ======================================================================== */

test('A1: Authenticated Buyer creates a valid request with correct statuses', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    },
    requests: { data: [], error: null },
    rpc: {
      evaluateRequest: { status: 'ALLOWED', reasons: [] }
    }
  });
  injectDb(db);

  const res = await rt.post('/requests', {
    authorization: buyerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: future,
    productTitle: 'High-performance laptop for business travel',
    productCategory: 'electronics',
    quantity: 1,
    declaredValueMinor: 850000,
    declaredCurrency: 'INR',
    hsCode: '85171200',
    fulfilmentMode: 'PASSENGER_BAGGAGE',
    isForThirdParty: false
  });

  assert.equal(res.statusCode, 201, 'Should create request successfully');
  assert.equal(res.body.data.request_status, 'PENDING_REVIEW', 'Request starts with PENDING_REVIEW status');
  assert.equal(res.body.data.compliance_status, 'REVIEW_REQUIRED', 'Compliance status should be REVIEW_REQUIRED');
});

test('A2: Request neededBy date in past is rejected', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    }
  });
  injectDb(db);

  const pastDate = new Date(Date.now() - 86400000).toISOString();

  const res = await rt.post('/requests', {
    authorization: buyerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: pastDate,
    productTitle: 'Test item',
    productCategory: 'electronics'
  });

  assert.equal(res.statusCode, 400, 'Should reject request with past neededBy');
});

test('A3: Non-buyer role cannot create request', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/requests', {
    authorization: travellerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: future,
    productTitle: 'Test item',
    productCategory: 'electronics'
  });

  assert.equal(res.statusCode, 403, 'Traveller cannot create request');
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('A4: Unauthorized request is rejected', async (t) => {
  const db = createMockSupabase();
  injectDb(db);

  const res = await rt.post('/requests', {
    authorization: 'invalid-token'
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: future,
    productTitle: 'Test',
    productCategory: 'electronics'
  });

  assert.equal(res.statusCode, 401, 'Should reject invalid token');
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

/* ========================================================================
 * SECTION B: Traveler Trip Workflow
 * ======================================================================== */

test('B1: Active, KYC-verified Traveler creates a trip', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    },
    trips: { data: [], error: null }
  });
  injectDb(db);

  const res = await rt.post('/trips', {
    authorization: travellerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    departureAt: future,
    arrivalAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    capacityKg: 20
  });

  assert.equal(res.statusCode, 201, 'Should create trip successfully');
  assert.equal(res.body.data.status, 'DRAFT', 'Trip starts as DRAFT');
});

test('B2: Traveler without VERIFIED KYC cannot create trip', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'SUBMITTED', full_name: 'Traveller One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/trips', {
    authorization: travellerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    departureAt: future,
    arrivalAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    capacityKg: 20
  });

  assert.equal(res.statusCode, 403, 'Should reject KYC requirement');
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

/* ========================================================================
 * SECTION C: Matching Workflow
 * ======================================================================== */

test('C1: Approved OPEN requests are eligible for traveler matching', async (t) => {
  const db = createMockSupabase({
    trips: {
      data: [tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE')],
      error: null
    },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, request_status: 'OPEN', compliance_status: 'APPROVED', needed_by: future }],
      error: null
    },
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.get('/requests?matching=me', {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 200, 'Should return matching requests');
  assert.ok(Array.isArray(res.body.data), 'Response should be an array');
});

test('C2: INACTIVE traveller is excluded from matching', async (t) => {
  const db = createMockSupabase({
    trips: {
      data: [],
      error: null
    },
    requests: {
      data: [],
      error: null
    },
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'INACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.get('/requests?matching=me', {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 403, 'Should reject inactive traveler');
  assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
});

test('C3: Traveler without VERIFIED KYC is excluded from matching', async (t) => {
  const db = createMockSupabase({
    trips: {
      data: [tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE')],
      error: null
    },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, request_status: 'OPEN', compliance_status: 'APPROVED', needed_by: future }],
      error: null
    },
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'SUBMITTED', full_name: 'Traveller One' }
      ],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.get('/requests?matching=me', {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 403, 'Should reject unverified KYC');
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

/* ========================================================================
 * SECTION D: Quote Acceptance Workflow
 * ======================================================================== */

test('D1: Valid quote acceptance succeeds and creates order', async (t) => {
  let orderData = null;
  const db = createMockSupabase({
    trips: {
      data: [{
        id: TRIP_ID,
        traveller_id: TRAVELLER_ID,
        status: 'ACTIVE',
        origin_country: 'US',
        origin_airport_code: 'JFK',
        destination_country: 'IN',
        destination_airport_code: 'BOM',
        departure_at: future,
        arrival_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        capacity_kg: 20
      }],
      error: null
    },
    quotes: {
      data: [{
        id: QUOTE_ID,
        request_id: REQUEST_ID,
        trip_id: TRIP_ID,
        traveller_id: TRAVELLER_ID,
        item_price_minor: 100000,
        item_currency: 'USD',
        traveller_reward_paise: 8000,
        fx_rate: '83.500000',
        fx_source: 'ENV_CONFIG',
        fx_timestamp: new Date().toISOString(),
        indicative_duty_paise: 12000,
        duty_source: 'manual_hs_8517',
        duty_reviewed_by: 'reviewer-1',
        duty_reviewed_at: new Date().toISOString(),
        duty_assessment_reference: 'REF-001',
        duty_assessment_status: 'APPROVED',
        platform_fee_bps: 500,
        status: 'ACTIVE',
        expires_at: future,
        requests: {
          id: REQUEST_ID,
          buyer_id: BUYER_ID,
          compliance_status: 'APPROVED',
          request_status: 'OPEN',
          origin_country: 'US',
          origin_airport_code: 'JFK',
          destination_country: 'IN',
          origin_airport_code: 'BOM',
          needed_by: future
        }
      }],
      error: null
    },
    requests: {
      data: [{
        id: REQUEST_ID,
        buyer_id: BUYER_ID,
        compliance_status: 'APPROVED',
        request_status: 'OPEN',
        origin_country: 'US',
        origin_airport_code: 'JFK',
        destination_country: 'IN',
        destination_airport_code: 'BOM',
        needed_by: future,
        hs_code: '85171200',
        fulfilment_mode: 'PASSENGER_BAGGAGE',
        is_for_third_party: false
      }],
      error: null
    },
    orders: {
      data: [],
      error: null
    },
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }
      ],
      error: null
    },
    rpc: {
      accept_quote: async () => {
        // Simulate RPC creating the order
        const { calculateOrderBreakdown } = await import('../src/services/money.js');
        const converted = { amountMinor: 835000 };
        const breakdown = calculateOrderBreakdown({
          productCostPaise: converted.amountMinor,
          dutyPaise: 12000,
          travellerRewardPaise: 8000,
          platformFeeBps: 500,
          depositBps: 20
        });
        orderData = {
          id: ORDER_ID,
          buyer_id: BUYER_ID,
          state: 'ACCEPTED',
          upfront_paise: breakdown.upfrontPaise,
          balance_paise: breakdown.balancePaise,
          subtotal_paise: breakdown.subtotalPaise,
          platform_fee_paise: breakdown.platformFeePaise,
          total_paise: breakdown.totalPaise,
          deposit_paise: breakdown.depositPaise,
          duty_paise: breakdown.dutyPaise,
          traveller_reward_paise: breakdown.travellerRewardPaise,
          currency: 'INR',
          payment_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          forfeit_at: null
        };
        db.setResponse('orders', { data: [orderData], error: null });
        return { data: ORDER_ID, error: null };
      }
    }
  });
  injectDb(db);

  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });

  assert.equal(res.statusCode, 201, `Should accept quote and create order: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.data.id, ORDER_ID);
  assert.equal(res.body.data.state, 'ACCEPTED');
  assert.ok(res.body.priceBreakdown, 'Should return price breakdown');
});

test('D2: Expired quote cannot be accepted', async (t) => {
  const db = createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', past, true, BUYER_ID)],
      error: null
    },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, request_status: 'OPEN', compliance_status: 'APPROVED' }],
      error: null
    },
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }
      ],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });

  assert.equal(res.statusCode, 409, 'Should reject expired quote');
  assert.equal(res.body.error.code, 'QUOTE_EXPIRED');
});

test('D3: Quote not yet duty-approved cannot be accepted', async (t) => {
  const db = createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, false, BUYER_ID)],
      error: null
    },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, request_status: 'OPEN', compliance_status: 'APPROVED' }],
      error: null
    },
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }
      ],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });

  assert.equal(res.statusCode, 409, 'Should reject quote without duty approval');
  assert.equal(res.body.error.code, 'DUTY_REVIEW_REQUIRED');
});

/* ========================================================================
 * SECTION E: Order State Transitions
 * ======================================================================== */

test('E1: Traveller can mark order as PURCHASED', async (t) => {
  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'PURCHASED' }, error: null }
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/purchased`, {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 200, 'Should transition to PURCHASED');
  assert.equal(res.body.data.state, 'PURCHASED');
});

// Note: E2, E3, E4, E5 tests are covered in detail in backend/tests/routes/apiRoutes.test.js
// These tests focus on the marketplace journey flow with minimal mock setup.

test('E3: Traveller can mark order as LANDED', async (t) => {
  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'PURCHASED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'LANDED' }, error: null }
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/landed`, {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 200, 'Should transition to LANDED');
  assert.equal(res.body.data.state, 'LANDED');
});

test('E4: Buyer can verify OTP for handover completion', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code });

  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    },
    otp_challenges: {
      data: [{
        id: 'ch-1',
        order_id: ORDER_ID,
        recipient_user_id: BUYER_ID,
        otp_hash: otpHash,
        attempts: 0,
        consumed_at: null,
        expires_at: future
      }],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'COMPLETED' }, error: null }
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code });

  assert.equal(res.statusCode, 200, 'Should verify OTP and complete');
  assert.equal(res.body.data.state, 'COMPLETED');
});

test('E5: Invalid OTP is rejected', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code });

  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    },
    otp_challenges: {
      data: [{
        id: 'ch-1',
        order_id: ORDER_ID,
        recipient_user_id: BUYER_ID,
        otp_hash: otpHash,
        attempts: 0,
        consumed_at: null,
        expires_at: future
      }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: '000000' });

  assert.equal(res.statusCode, 401, 'Should reject invalid OTP');
  assert.equal(res.body.error.code, 'OTP_INVALID');
});

test('E4: Buyer can verify OTP for handover completion', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code });

  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    },
    otp_challenges: {
      data: [{
        id: 'ch-1',
        order_id: ORDER_ID,
        recipient_user_id: BUYER_ID,
        otp_hash: otpHash,
        attempts: 0,
        consumed_at: null,
        expires_at: future
      }],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'COMPLETED' }, error: null }
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code });

  assert.equal(res.statusCode, 200, 'Should verify OTP and complete');
  assert.equal(res.body.data.state, 'COMPLETED');
});

test('E5: Invalid OTP is rejected', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code });

  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    },
    otp_challenges: {
      data: [{
        id: 'ch-1',
        order_id: ORDER_ID,
        recipient_user_id: BUYER_ID,
        otp_hash: otpHash,
        attempts: 0,
        consumed_at: null,
        expires_at: future
      }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: '000000' });

  assert.equal(res.statusCode, 401, 'Should reject invalid OTP');
  assert.equal(res.body.error.code, 'OTP_INVALID');
});

/* ========================================================================
 * SECTION F: Payment Workflow
 * ======================================================================== */

test('F1: Payment intent creation works with correct amount', async (t) => {
  const db = createMockSupabase({
    trips: {
      data: [tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE')],
      error: null
    },
    quotes: {
      data: [{
        id: QUOTE_ID,
        request_id: REQUEST_ID,
        trip_id: TRIP_ID,
        traveller_id: TRAVELLER_ID,
        item_price_minor: 1_000,
        item_currency: 'USD',
        traveller_reward_paise: 8_000,
        fx_rate: '83.500000',
        fx_source: 'ENV_CONFIG',
        fx_timestamp: new Date().toISOString(),
        indicative_duty_paise: 12_000,
        duty_source: 'manual_hs_8517',
        duty_reviewed_by: 'reviewer-1',
        duty_reviewed_at: new Date().toISOString(),
        duty_assessment_reference: 'REF-001',
        duty_assessment_status: 'APPROVED',
        platform_fee_bps: 500,
        status: 'ACTIVE',
        expires_at: future,
        requests: { id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED', request_status: 'OPEN' }
      }],
      error: null
    },
    orders: {
      data: [{
        id: ORDER_ID,
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        quote_id: QUOTE_ID,
        state: 'ACCEPTED',
        upfront_paise: 37_050,
        balance_paise: 70_625,
        subtotal_paise: 103_500,
        platform_fee_paise: 4_175,
        total_paise: 107_675,
        deposit_paise: 20_875,
        duty_paise: 12_000,
        traveller_reward_paise: 8_000,
        currency: 'INR',
        payment_deadline: freshFuture(10),
        forfeit_at: null
      }],
      error: null
    },
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }
      ],
      error: null
    },
    payment_intents: {
      data: [],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': `idem_${ORDER_ID}-payment`
  }, { orderId: ORDER_ID });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.provider, 'MOCK');
  assert.equal(res.body.data.amountPaise, 37_050);
  assert.equal(res.body.data.currency, 'INR');
  assert.equal(res.body.data.mock, true);
  assert.ok(res.body.data.providerOrderId.startsWith('mock_'));
});

test('F2: Missing idempotency key rejected', async (t) => {
  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future), upfront_paise: 42_000 }],
      error: null
    },
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken()
  }, { orderId: ORDER_ID });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
});

/* ========================================================================
 * SECTION G: Security Tests
 * ======================================================================== */

test('G1: Buyer cannot view other users quotes without permission', async (t) => {
  const OTHER_BUYER_ID = testUuid(110);
  const THIRD_BUYER_ID = testUuid(111);
  const db = createMockSupabase({
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: OTHER_BUYER_ID, request_status: 'OPEN', compliance_status: 'APPROVED' }],
      error: null
    },
    quotes: {
      data: [],
      error: null
    },
    profiles: {
      data: [{ id: THIRD_BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Third Buyer' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, {
    authorization: `Bearer ${THIRD_BUYER_ID}-token`
  });

  assert.equal(res.statusCode, 403, 'Should reject non-owner quote access');
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('G2: Buyer cannot access order of unrelated request', async (t) => {
  // Note: Order access control is tested in detail in apiRoutes.test.js
  // This test verifies the mock returns correct 404
  const db = createMockSupabase({
    orders: { data: [], error: null }
  });
  injectDb(db);

  const res = await rt.get(`/orders/${ORDER_ID}`, {
    authorization: travellerToken()
  });

  assert.equal(res.statusCode, 404, 'Should not find order');
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});

// Note: G3, G4 tests are covered in detail in apiRoutes.test.js
// These tests focus on the marketplace journey flow with minimal mock setup.

test('G5: Traveller cannot dispute order (only participants)', async (t) => {
  const STRANGER_ID = testUuid(99);
  const db = createMockSupabase({
    orders: {
      data: [{ ...orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null), traveller_id: TRAVELLER_ID }],
      error: null
    },
    profiles: {
      data: [{ id: STRANGER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Stranger' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post(`/orders/${ORDER_ID}/dispute`, {
    authorization: `Bearer ${STRANGER_ID}-token`
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

/* ========================================================================
 * SECTION H: Request Validation Tests (using Zod schemas via API)
 * ======================================================================== */

test('H1: Request with same origin and destination airports is rejected', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/requests', {
    authorization: buyerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'US',
    destinationAirportCode: 'JFK',
    neededBy: future,
    productTitle: 'Test item',
    productCategory: 'electronics'
  });

  assert.equal(res.statusCode, 400);
});

test('H2: Request validation enforces product title length', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    }
  });
  injectDb(db);

  const longTitle = 'a'.repeat(200);
  const res = await rt.post('/requests', {
    authorization: buyerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: future,
    productTitle: longTitle,
    productCategory: 'electronics'
  });

  assert.equal(res.statusCode, 400);
});

test('H3: Request validation enforces quantity range', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/requests', {
    authorization: buyerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    neededBy: future,
    productTitle: 'Test item',
    productCategory: 'electronics',
    quantity: 0 // Invalid - must be min 1
  });

  assert.equal(res.statusCode, 400);
});

test('H4: Trip validation enforces arrival after departure', async (t) => {
  const db = createMockSupabase({
    profiles: {
      data: [{ id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }],
      error: null
    }
  });
  injectDb(db);

  const res = await rt.post('/trips', {
    authorization: travellerToken()
  }, {
    originCountry: 'US',
    originAirportCode: 'JFK',
    destinationCountry: 'IN',
    destinationAirportCode: 'BOM',
    departureAt: future,
    arrivalAt: new Date(Date.now() - 1000).toISOString(), // Before departure
    capacityKg: 20
  });

  assert.equal(res.statusCode, 400);
});

// Note: Quote validation tests are covered in detail in apiRoutes.test.js
// These tests focus on the marketplace journey flow with minimal mock setup.

/* ========================================================================
 * SECTION I: Health Check and Config Tests
 * ======================================================================== */

test('I1: Health check endpoint returns ok', async (t) => {
  const db = createMockSupabase();
  injectDb(db);

  const res = await rt.get('/health');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ok');
});

test('I2: Config endpoint returns mock payment config', async (t) => {
  const db = createMockSupabase();
  injectDb(db);

  const res = await rt.get('/config');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mockPayments, true);
  assert.equal(res.body.realPaymentsEnabled, false);
  assert.equal(res.body.complianceApprovalRequired, true);
});