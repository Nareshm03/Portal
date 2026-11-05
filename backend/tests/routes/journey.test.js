/** Complete end-to-end mock transaction journey test.
 *
 * Tests the full sequence using actual Express route handlers:
 *
 *   ACCEPTED → mock payment → LOCKED → PURCHASED → LANDED → OTP issued → OTP verified → COMPLETED
 *
 * Verifies that:
 *   - Financial snapshots remain unchanged throughout the journey
 *   - Collection and settlement ledger postings are idempotent
 *   - Each state transition is authorized and valid
 *
 * No live database, row locks, or PostgreSQL triggers are exercised.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase, orderRow, intentRow, quoteRow, requestRow, tripRow, profileRow, future, testUuid } from '../helpers/mockSupabase.js';
import { createRouteTester, injectDb } from '../helpers/routeTester.js';
import { calculateOrderBreakdown } from '../../src/services/money.js';
import { hashOtp } from '../../src/services/otp.js';

const rt = createRouteTester();

const BUYER_ID = testUuid(1);
const TRAVELLER_ID = testUuid(2);
const ORDER_ID = testUuid(3);
const QUOTE_ID = testUuid(4);
const REQUEST_ID = testUuid(5);
const TRIP_ID = testUuid(6);
const INTENT_ID = testUuid(7);

function buyerToken() { return `Bearer ${BUYER_ID}-token`; }
function travellerToken() { return `Bearer ${TRAVELLER_ID}-token`; }

test('complete mock journey: ACCEPTED → payment → LOCKED → PURCHASED → LANDED → OTP → COMPLETED', async (t) => {
  const expectedSnapshot = {
    productCostPaise: 83_500,
    dutyPaise: 12_000,
    travellerRewardPaise: 8_000,
    platformFeePaise: 4_175,
    depositPaise: 20_875,
    subtotalPaise: 103_500,
    totalPaise: 107_675,
    upfrontPaise: 37_050,
    balancePaise: 70_625
  };

  let collectionLedgerCount = 0;
  let settlementLedgerCount = 0;

  const db = createMockSupabase({
    profiles: {
      data: [
        { id: BUYER_ID, role: 'buyer', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Buyer One' },
        { id: TRAVELLER_ID, role: 'traveller', account_status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Traveller One' }
      ],
      error: null
    },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, status: 'OPEN', compliance_status: 'APPROVED' }],
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
        platform_fee_bps: 500,
        status: 'ACTIVE',
        expires_at: future,
        requests: { id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED', status: 'OPEN' }
      }],
      error: null
    },
    trips: {
      data: [{
        id: TRIP_ID,
        traveller_id: TRAVELLER_ID,
        status: 'ACTIVE',
        origin_country: 'US',
        origin_airport_code: 'JFK',
        destination_country: 'IN',
        destination_airport_code: 'BLR',
        departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        capacity_kg: 10
      }],
      error: null
    },
    orders: {
      data: [{
        id: ORDER_ID,
        buyer_id: BUYER_ID,
        traveller_id: TRAVELLER_ID,
        state: 'ACCEPTED',
        subtotal_paise: expectedSnapshot.subtotalPaise,
        platform_fee_paise: expectedSnapshot.platformFeePaise,
        total_paise: expectedSnapshot.totalPaise,
        deposit_paise: expectedSnapshot.depositPaise,
        duty_paise: expectedSnapshot.dutyPaise,
        traveller_reward_paise: expectedSnapshot.travellerRewardPaise,
        upfront_paise: expectedSnapshot.upfrontPaise,
        balance_paise: expectedSnapshot.balancePaise,
        currency: 'INR',
        payment_deadline: future,
        forfeit_at: null
      }],
      error: null
    },
    payment_intents: {
      data: [],
      error: null
    },
    otp_challenges: {
      data: [],
      error: null
    },
    rpc: {
      accept_quote: { data: ORDER_ID, error: null },
      transition_order: async ({ p_order_id, p_to_state, p_actor_id, p_note }) => {
        return { data: { id: ORDER_ID, state: p_to_state }, error: null };
      },
      post_ledger_transaction: async ({ p_idempotency_key, p_event_type }) => {
        if (p_event_type === 'PAYMENT_CAPTURED') collectionLedgerCount++;
        if (p_event_type === 'ORDER_SETTLED') settlementLedgerCount++;
        return { data: `ledger-${collectionLedgerCount + settlementLedgerCount}`, error: null };
      }
    }
  });

  injectDb(db);

  // --- Step 1: Accept quote (buyer) ---
  const acceptRes = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });
  assert.equal(acceptRes.statusCode, 201, `Quote acceptance failed: ${JSON.stringify(acceptRes.body)}`);
  assert.equal(acceptRes.body.data.state, 'ACCEPTED');
  assert.equal(acceptRes.body.priceBreakdown.upfrontPaise, expectedSnapshot.upfrontPaise);
  assert.equal(acceptRes.body.priceBreakdown.balancePaise, expectedSnapshot.balancePaise);
  assert.equal(acceptRes.body.priceBreakdown.totalPaise, expectedSnapshot.totalPaise);

  // --- Step 2: Create payment intent (buyer) ---
  const createRes = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': 'journey-payment-key-1'
  }, { orderId: ORDER_ID });
  assert.equal(createRes.statusCode, 201, `Payment creation failed: ${JSON.stringify(createRes.body)}`);
  assert.equal(createRes.body.data.provider, 'MOCK');
  assert.equal(createRes.body.data.amountPaise, expectedSnapshot.upfrontPaise, 'Payment intent must match upfront collection, not deposit');
  assert.equal(createRes.body.data.mock, true);

  const createdIntentId = createRes.body.data.id;
  const createdProviderOrderId = createRes.body.data.providerOrderId;

  // --- Step 3: Verify mock payment → LOCKED ---
  const verifyRes = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: createdIntentId,
    providerOrderId: createdProviderOrderId
  });
  assert.equal(verifyRes.statusCode, 200, `Payment verify failed: ${JSON.stringify(verifyRes.body)}`);
  assert.equal(verifyRes.body.data.orderState, 'LOCKED');
  assert.equal(collectionLedgerCount, 1, 'Collection ledger posted exactly once on lock');

  // --- Step 4: Traveller confirms PURCHASED ---
  const purchasedRes = await rt.post(`/orders/${ORDER_ID}/purchased`, {
    authorization: travellerToken()
  });
  assert.equal(purchasedRes.statusCode, 200, `Purchase failed: ${JSON.stringify(purchasedRes.body)}`);
  assert.equal(purchasedRes.body.data.state, 'PURCHASED');

  // --- Step 5: Traveller confirms LANDED ---
  const landedRes = await rt.post(`/orders/${ORDER_ID}/landed`, {
    authorization: travellerToken()
  });
  assert.equal(landedRes.statusCode, 200, `Land failed: ${JSON.stringify(landedRes.body)}`);
  assert.equal(landedRes.body.data.state, 'LANDED');

  // --- Step 6: Issue OTP (buyer) ---
  const otpRes = await rt.post(`/orders/${ORDER_ID}/handover/issue-otp`, {
    authorization: buyerToken()
  });
  assert.equal(otpRes.statusCode, 200, `OTP issue failed: ${JSON.stringify(otpRes.body)}`);
  assert.equal(otpRes.body.data.recipient, 'buyer');
  assert.ok(otpRes.body.code);
  assert.equal(otpRes.body.code.length, 6);
  const otpCode = otpRes.body.code;

  // --- Step 7: Verify OTP → COMPLETED ---
  const origPepper = process.env.OTP_PEPPER;
  process.env.OTP_PEPPER = 'development-only-change-this-otp-pepper-32chars';
  const expectedHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code: otpCode });

  db.setResponse('otp_challenges', {
    data: [{
      id: 'ch-1', order_id: ORDER_ID, recipient_user_id: BUYER_ID,
      otp_hash: expectedHash, attempts: 0, consumed_at: null, expires_at: future
    }],
    error: null
  });

  const completeRes = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: otpCode });
  assert.equal(completeRes.statusCode, 200, `Complete failed: ${JSON.stringify(completeRes.body)}`);
  assert.equal(completeRes.body.data.state, 'COMPLETED');
  assert.equal(settlementLedgerCount, 1, 'Settlement ledger posted exactly once on completion');

  process.env.OTP_PEPPER = origPepper;

  // --- Step 8: Verify financial snapshot unchanged ---
  const orderRes = await rt.get(`/orders/${ORDER_ID}`, { authorization: buyerToken() });
  assert.equal(orderRes.statusCode, 200);
  const order = orderRes.body.data;
  assert.equal(order.state, 'COMPLETED');
  assert.equal(order.upfront_paise, expectedSnapshot.upfrontPaise, 'Upfront amount unchanged');
  assert.equal(order.balance_paise, expectedSnapshot.balancePaise, 'Balance unchanged');
  assert.equal(order.total_paise, expectedSnapshot.totalPaise, 'Total unchanged');
  assert.equal(order.deposit_paise, expectedSnapshot.depositPaise, 'Deposit unchanged');

  // --- Step 9: Idempotency - repeat payment verify does not duplicate ledger ---
  const dupVerifyRes = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: createdIntentId,
    providerOrderId: createdProviderOrderId
  });
  assert.equal(dupVerifyRes.statusCode, 200);
  assert.equal(dupVerifyRes.body.data.duplicate, true);
  assert.equal(collectionLedgerCount, 1, 'Collection ledger still exactly once after duplicate verify');

  // --- Step 10: Idempotency - repeat complete does not duplicate settlement ---
  const dupCompleteRes = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: otpCode });
  assert.equal(dupCompleteRes.statusCode, 200);
  assert.equal(dupCompleteRes.body.data.state, 'COMPLETED');
  assert.equal(settlementLedgerCount, 1, 'Settlement ledger still exactly once after duplicate complete');
});

test('journey: financial snapshot is frozen - fee and deposit based on product cost excluding duty', () => {
  const breakdown = calculateOrderBreakdown({
    productCostPaise: 83_500,
    dutyPaise: 12_000,
    travellerRewardPaise: 8_000,
    platformFeeBps: 500,
    depositBps: 2500
  });

  assert.equal(breakdown.platformFeePaise, 4_175, 'Platform fee = 5% of 83,500');
  assert.equal(breakdown.depositPaise, 20_875, 'Deposit = 25% of 83,500');
  assert.equal(breakdown.upfrontPaise, 20_875 + 12_000 + 4_175);
  assert.equal(breakdown.balancePaise, breakdown.totalPaise - breakdown.upfrontPaise);

  const highDuty = calculateOrderBreakdown({
    productCostPaise: 83_500, dutyPaise: 50_000, travellerRewardPaise: 0, platformFeeBps: 500, depositBps: 2500
  });
  assert.equal(highDuty.platformFeePaise, breakdown.platformFeePaise);
  assert.equal(highDuty.depositPaise, breakdown.depositPaise);
});
