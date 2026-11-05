/**
 * Route-level tests for admin transaction monitoring endpoints.
 *
 * Uses the routeTester + mockSupabase helpers — no live database.
 * Verifies admin authorization, endpoint behaviour, filtering, timeline
 * ordering, sensitive-field redaction, and exception visibility.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockSupabase,
  orderRow,
  intentRow,
  profileRow,
  testUuid,
  future,
  past,
} from '../helpers/mockSupabase.js';
import { createRouteTester, injectDb } from '../helpers/routeTester.js';

const rt = createRouteTester();

const ADMIN_ID    = testUuid(10);
const BUYER_ID    = testUuid(1);
const TRAVELLER_ID = testUuid(2);
const ORDER_ID    = testUuid(3);
const INTENT_ID   = testUuid(7);

function adminToken() { return `Bearer ${ADMIN_ID}-token`; }
function buyerToken()  { return `Bearer ${BUYER_ID}-token`; }

function fullOrderRow(id = ORDER_ID, state = 'LOCKED', upfront = 42_000) {
  return orderRow(id, BUYER_ID, state, upfront, future, null, {
    traveller_id: TRAVELLER_ID,
    subtotal_paise: 120_000, platform_fee_paise: 5_000, total_paise: 125_000,
    deposit_paise: 25_000, duty_paise: 12_000, traveller_reward_paise: 8_000,
    balance_paise: 83_000, currency: 'INR', created_at: '2026-11-05T10:00:00.000Z',
    updated_at: '2026-11-05T10:05:00.000Z',
  });
}

function ledgerTxn(id, orderId, eventType, key) {
  return { id, order_id: orderId, event_type: eventType, idempotency_key: key, created_at: '2026-11-05T10:03:00.000Z' };
}

/* ================================================================== */
/* Authorization                                                       */
/* ================================================================== */

test('GET /admin/transactions - unauthenticated returns 401', async () => {
  injectDb(createMockSupabase());
  const res = await rt.get('/admin/transactions');
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

test('GET /admin/transactions - buyer role returns 403', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('GET /admin/transactions - traveller role returns 403', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: `Bearer ${TRAVELLER_ID}-token` });
  assert.equal(res.statusCode, 403);
});

test('GET /admin/transactions - suspended admin account returns 403', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'SUSPENDED', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: adminToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
});

/* ================================================================== */
/* GET /admin/transactions — list                                      */
/* ================================================================== */

test('GET /admin/transactions - active admin returns order list', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    payment_intents: { data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'prov_1')], error: null },
    ledger_transactions: { data: [ledgerTxn('t1', ORDER_ID, 'PAYMENT_CAPTURED', `order:lock:${ORDER_ID}`)], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  const row = res.body.data[0];
  assert.equal(row.orderId, ORDER_ID);
  assert.equal(row.paymentStatus, 'CAPTURED');
  assert.equal(row.collectionLedgerPresent, true);
  assert.equal(row.state, 'LOCKED');
});

test('GET /admin/transactions - empty database returns empty list', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /admin/transactions - list row never exposes sensitive fields', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get('/admin/transactions', { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  const row = res.body.data[0];
  assert.ok(!('otp_hash' in row));
  assert.ok(!('raw_provider_reference' in row));
  assert.ok(!('full_name' in row));
});

test('GET /admin/transactions - state filter applies', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: {
      data: [
        fullOrderRow(ORDER_ID, 'LOCKED'),
        { ...fullOrderRow(testUuid(20), 'COMPLETED'), state: 'COMPLETED' },
      ],
      error: null,
    },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get('/admin/transactions?state=LOCKED', { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  // Mock DB will return all orders (it eq-filters on 'state' = 'LOCKED') - both match via mock equality
  // Important: the route applies the filter via the supabase query chain, so mock must support it
  assert.ok(res.body.data.every((r) => r.state === 'LOCKED'));
});

test('GET /admin/transactions - invalid state returns 400', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/admin/transactions?state=INVALID', { authorization: adminToken() });
  assert.equal(res.statusCode, 400);
});

test('GET /admin/transactions - limit and offset are bounded', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [], error: null },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  // limit > MAX_PAGE_LIMIT should return 400 from zod
  const res = await rt.get('/admin/transactions?limit=999', { authorization: adminToken() });
  assert.equal(res.statusCode, 400);
});

/* ================================================================== */
/* GET /admin/transactions/:orderId/timeline                           */
/* ================================================================== */

test('GET /admin/transactions/:orderId/timeline - returns chronological events', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    order_events: {
      data: [
        { from_state: null, to_state: 'ACCEPTED', actor_id: BUYER_ID, note: null, created_at: '2026-11-05T09:00:00.000Z' },
        { from_state: 'ACCEPTED', to_state: 'LOCKED', actor_id: BUYER_ID, note: null, created_at: '2026-11-05T09:10:00.000Z' },
      ],
      error: null,
    },
    payment_intents: {
      data: [{ ...intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'prov_1'), updated_at: '2026-11-05T09:05:00.000Z' }],
      error: null,
    },
    ledger_transactions: {
      data: [ledgerTxn('t1', ORDER_ID, 'PAYMENT_CAPTURED', `order:lock:${ORDER_ID}`)],
      error: null,
    },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/timeline`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.data.length >= 2, 'timeline should have at least 2 events');
  // Verify chronological ordering
  for (let i = 1; i < res.body.data.length; i++) {
    assert.ok(res.body.data[i - 1].at <= res.body.data[i].at, 'Events must be sorted ascending');
  }
});

test('GET /admin/transactions/:orderId/timeline - empty history returns empty array', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    order_events: { data: [], error: null },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/timeline`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /admin/transactions/:orderId/timeline - non-existent order returns 404', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/timeline`, { authorization: adminToken() });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});

test('GET /admin/transactions/:orderId/timeline - never exposes raw_provider_reference or payload', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    order_events: { data: [], error: null },
    payment_intents: {
      data: [{ ...intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'prov_1'), raw_provider_reference: { key: 'secret' } }],
      error: null,
    },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/timeline`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  for (const ev of res.body.data) {
    assert.ok(!('raw_provider_reference' in ev));
    assert.ok(!('payload' in ev));
  }
});

test('GET /admin/transactions/:orderId/timeline - non-admin returns 403', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/timeline`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
});

/* ================================================================== */
/* GET /admin/transactions/:orderId/summary                            */
/* ================================================================== */

test('GET /admin/transactions/:orderId/summary - returns full financial snapshot', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'prov_1')],
      error: null,
    },
    ledger_transactions: {
      data: [ledgerTxn('t1', ORDER_ID, 'PAYMENT_CAPTURED', `order:lock:${ORDER_ID}`)],
      error: null,
    },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  const data = res.body.data;
  assert.equal(data.orderId, ORDER_ID);
  assert.equal(data.state, 'LOCKED');
  assert.equal(data.paymentStatus, 'CAPTURED');
  assert.equal(data.collectionLedgerPresent, true);
  assert.equal(data.settlementLedgerPresent, false);
  assert.equal(data.isDisputed, false);
  assert.equal(data.financials.upfrontPaise, 42_000);
  assert.equal(data.financials.balancePaise, 83_000);
  assert.ok(Array.isArray(data.exceptions));
});

test('GET /admin/transactions/:orderId/summary - exception flag for captured but unlocked', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow(ORDER_ID, 'ACCEPTED')], error: null },
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'prov_1')],
      error: null,
    },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.hasExceptions, true);
  const cats = res.body.data.exceptions.map((e) => e.category);
  assert.ok(cats.includes('CAPTURED_ORDER_NOT_LOCKED'));
});

test('GET /admin/transactions/:orderId/summary - missing collection ledger is a flagged exception', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow(ORDER_ID, 'LOCKED')], error: null },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.hasExceptions, true);
  assert.ok(res.body.data.exceptions.some((e) => e.category === 'LOCKED_MISSING_COLLECTION_LEDGER'));
});

test('GET /admin/transactions/:orderId/summary - missing settlement exception for completed order', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow(ORDER_ID, 'COMPLETED')], error: null },
    payment_intents: { data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000)], error: null },
    ledger_transactions: {
      data: [ledgerTxn('t1', ORDER_ID, 'PAYMENT_CAPTURED', `order:lock:${ORDER_ID}`)],
      error: null,
    },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.exceptions.some((e) => e.category === 'COMPLETED_MISSING_SETTLEMENT_LEDGER'));
});

test('GET /admin/transactions/:orderId/summary - clean order has no exceptions', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow(ORDER_ID, 'LOCKED')], error: null },
    payment_intents: { data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000)], error: null },
    ledger_transactions: {
      data: [ledgerTxn('t1', ORDER_ID, 'PAYMENT_CAPTURED', `order:lock:${ORDER_ID}`)],
      error: null,
    },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.hasExceptions, false);
  assert.deepEqual(res.body.data.exceptions, []);
});

test('GET /admin/transactions/:orderId/summary - non-existent order returns 404', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});

test('GET /admin/transactions/:orderId/summary - non-admin returns 403', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
});

test('GET /admin/transactions/:orderId/summary - sensitive fields are not exposed', async () => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    orders: { data: [fullOrderRow()], error: null },
    payment_intents: { data: [], error: null },
    ledger_transactions: { data: [], error: null },
  }));
  const res = await rt.get(`/admin/transactions/${ORDER_ID}/summary`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes('"otp_hash"'));
  assert.ok(!text.includes('"raw_provider_reference"'));
  assert.ok(!text.includes('"password"'));
});
