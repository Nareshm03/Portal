/** Route-level tests for the Portal transaction API.
 *
 * These tests exercise the actual Express route handlers by invoking
 * `app.handle(req, res)` with mock request/response objects. A fake Supabase
 * client is injected via `globalThis.__portal_test_db__` so no live database
 * or Supabase credentials are required.
 *
 * Mocks used:
 *   - tests/helpers/mockSupabase.js: fake Supabase query-builder client
 *   - tests/helpers/routeTester.js: direct Express route invocation
 *
 * No database transactions, row locks, or triggers are exercised here —
 * those require a live PostgreSQL instance.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase, orderRow, intentRow, quoteRow, requestRow, tripRow, profileRow, future, past, testUuid } from '../helpers/mockSupabase.js';
import { createRouteTester, injectDb } from '../helpers/routeTester.js';
import { hashOtp } from '../../src/services/otp.js';

const rt = createRouteTester();

/* ------------------------------------------------------------------ */
/* Test data with UUIDs                                               */
/* ------------------------------------------------------------------ */

const BUYER_ID = testUuid(1);
const TRAVELLER_ID = testUuid(2);
const ORDER_ID = testUuid(3);
const QUOTE_ID = testUuid(4);
const REQUEST_ID = testUuid(5);
const TRIP_ID = testUuid(6);
const INTENT_ID = testUuid(7);

function buyerToken() { return `Bearer ${BUYER_ID}-token`; }
function travellerToken() { return `Bearer ${TRAVELLER_ID}-token`; }

/* ------------------------------------------------------------------ */
/* Section 1: Authentication middleware                               */
/* ------------------------------------------------------------------ */

test('GET /api/v1/me requires authentication', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.get('/me');
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

test('POST /api/v1/quotes/:id/accept requires buyer role', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, { authorization: travellerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

/* ------------------------------------------------------------------ */
/* Section 2: Quote acceptance                                        */
/* ------------------------------------------------------------------ */

test('POST /api/v1/quotes/:id/accept - buyer owns request, duty approved, creates order', async (t) => {
  injectDb(createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID)],
      error: null
    },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      accept_quote: { data: ORDER_ID, error: null }
    }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.id, ORDER_ID);
  assert.equal(res.body.data.state, 'ACCEPTED');
  assert.ok(res.body.priceBreakdown);
});

test('POST /api/v1/quotes/:id/accept - non-owner buyer rejected', async (t) => {
  const otherBuyerId = testUuid(8);
  injectDb(createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID)],
      error: null
    },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')],
      error: null
    },
    profiles: {
      data: [profileRow(otherBuyerId, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: `Bearer ${otherBuyerId}-token`
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'QUOTE_NOT_FOUND');
});

test('POST /api/v1/quotes/:id/accept - expired quote rejected', async (t) => {
  injectDb(createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', past, true, BUYER_ID)],
      error: null
    },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'QUOTE_EXPIRED');
});

test('POST /api/v1/quotes/:id/accept - duty not approved rejected', async (t) => {
  injectDb(createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, false, BUYER_ID)],
      error: null
    },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'DUTY_REVIEW_REQUIRED');
});

test('POST /api/v1/quotes/:id/accept - duplicate acceptance rejected by RPC', async (t) => {
  injectDb(createMockSupabase({
    quotes: {
      data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACCEPTED', future, true, BUYER_ID)],
      error: null
    },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'MATCHED', 'APPROVED')],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      accept_quote: { data: null, error: { code: '23514', message: 'quote already accepted' } }
    }
  }));
  const res = await rt.post(`/quotes/${QUOTE_ID}/accept`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'QUOTE_ACCEPT_FAILED');
});

/* ------------------------------------------------------------------ */
/* Section 3: Payment intent creation                                 */
/* ------------------------------------------------------------------ */

test('POST /api/v1/payments/create-order - creates MOCK payment intent with upfront amount', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future, null, {
        deposit_paise: 25_000, duty_paise: 12_000, platform_fee_paise: 5_000
      })],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    payment_intents: {
      data: [],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': 'key-1-test-12345'
  }, { orderId: ORDER_ID });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.provider, 'MOCK');
  assert.equal(res.body.data.amountPaise, 42_000);
  assert.equal(res.body.data.currency, 'INR');
  assert.equal(res.body.data.mock, true);
  assert.ok(res.body.data.providerOrderId.startsWith('mock_'));
});

test('POST /api/v1/payments/create-order - missing idempotency key rejected', async (t) => {
  injectDb(createMockSupabase({
    orders: { data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future)], error: null },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken()
  }, { orderId: ORDER_ID });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
});

test('POST /api/v1/payments/create-order - idempotent retry returns original intent', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CREATED', 42_000, 'mock_i1')],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': `idem_${INTENT_ID}`
  }, { orderId: ORDER_ID });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, INTENT_ID);
  assert.equal(res.body.data.duplicate, true);
});

test('POST /api/v1/payments/create-order - conflicting idempotency key rejected', async (t) => {
  const otherBuyerId = testUuid(8);
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, otherBuyerId, 'ACCEPTED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [
        profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED'),
        profileRow(otherBuyerId, 'buyer', 'ACTIVE', 'VERIFIED')
      ],
      error: null
    },
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, otherBuyerId, 'MOCK', 'CREATED', 42_000, 'mock_i1')],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: `Bearer ${otherBuyerId}-token`,
    'idempotency-key': `idem_${INTENT_ID}`
  }, { orderId: ORDER_ID });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
});

test('POST /api/v1/payments/create-order - order not in ACCEPTED state rejected', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': 'key-1-test-12345'
  }, { orderId: ORDER_ID });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'PAYMENT_WINDOW_CLOSED');
});

test('POST /api/v1/payments/create-order - payment window expired rejected', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, past)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post('/payments/create-order', {
    authorization: buyerToken(),
    'idempotency-key': 'key-1-test-12345'
  }, { orderId: ORDER_ID });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'PAYMENT_WINDOW_CLOSED');
});

/* ------------------------------------------------------------------ */
/* Section 4: Payment verification                                    */
/* ------------------------------------------------------------------ */

test('POST /api/v1/payments/verify - mock payment captured, order locked, collection ledger posted', async (t) => {
  let collectionLedgerCalls = 0;
  const db = createMockSupabase({
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CREATED', 42_000, 'mock_i1')],
      error: null
    },
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'LOCKED' }, error: null },
      post_ledger_transaction: { data: 'ledger-1', error: null }
    }
  });
  const origRpc = db.rpc.bind(db);
  db.rpc = async (funcName, params) => {
    if (funcName === 'post_ledger_transaction') collectionLedgerCalls++;
    return origRpc(funcName, params);
  };
  injectDb(db);

  const res = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: INTENT_ID,
    providerOrderId: 'mock_i1'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, 'CAPTURED');
  assert.equal(res.body.data.orderState, 'LOCKED');
  assert.equal(collectionLedgerCalls, 1, 'collection ledger should be posted exactly once');
});

test('POST /api/v1/payments/verify - duplicate verify (already captured) posts collection ledger once', async (t) => {
  let collectionLedgerCalls = 0;
  const db = createMockSupabase({
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CAPTURED', 42_000, 'mock_i1')],
      error: null
    },
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'LOCKED' }, error: null },
      post_ledger_transaction: { data: 'ledger-1', error: null }
    }
  });
  const origRpc = db.rpc.bind(db);
  db.rpc = async (funcName, params) => {
    if (funcName === 'post_ledger_transaction') collectionLedgerCalls++;
    return origRpc(funcName, params);
  };
  injectDb(db);

  const res = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: INTENT_ID,
    providerOrderId: 'mock_i1'
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.duplicate, true);
  assert.equal(collectionLedgerCalls, 1, 'collection ledger posted exactly once on duplicate verify');
});

test('POST /api/v1/payments/verify - payment order mismatch rejected', async (t) => {
  injectDb(createMockSupabase({
    payment_intents: {
      data: [intentRow(INTENT_ID, ORDER_ID, BUYER_ID, 'MOCK', 'CREATED', 42_000, 'mock_i1')],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: INTENT_ID,
    providerOrderId: 'wrong_order'
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'PAYMENT_ORDER_MISMATCH');
});

test('POST /api/v1/payments/verify - payment intent not found', async (t) => {
  injectDb(createMockSupabase({
    payment_intents: { data: [], error: null },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post('/payments/verify', {
    authorization: buyerToken()
  }, {
    paymentIntentId: testUuid(10),
    providerOrderId: 'mock_x'
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'PAYMENT_INTENT_NOT_FOUND');
});

/* ------------------------------------------------------------------ */
/* Section 5: Order lifecycle transitions                             */
/* ------------------------------------------------------------------ */

test('POST /api/v1/orders/:id/purchased - traveller confirms purchase', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'PURCHASED' }, error: null }
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/purchased`, {
    authorization: travellerToken()
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.state, 'PURCHASED');
});

test('POST /api/v1/orders/:id/purchased - non-traveller rejected', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/purchased`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /api/v1/orders/:id/landed - traveller confirms arrival', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'PURCHASED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'LANDED' }, error: null }
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/landed`, {
    authorization: travellerToken()
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.state, 'LANDED');
});

test('POST /api/v1/orders/:id/dispute - order participant can dispute', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [
        profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED'),
        profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')
      ],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'DISPUTED' }, error: null }
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/dispute`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.state, 'DISPUTED');
});

test('POST /api/v1/orders/:id/dispute - non-participant rejected', async (t) => {
  const strangerId = testUuid(99);
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LOCKED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(strangerId, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/dispute`, {
    authorization: `Bearer ${strangerId}-token`
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('GET /api/v1/orders/:id - order participant can view', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.get(`/orders/${ORDER_ID}`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.id, ORDER_ID);
});

test('GET /api/v1/orders/:id - non-participant cannot view', async (t) => {
  const strangerId = testUuid(99);
  injectDb(createMockSupabase({
    orders: { data: [], error: null },
    profiles: {
      data: [profileRow(strangerId, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.get(`/orders/${ORDER_ID}`, { authorization: `Bearer ${strangerId}-token` });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});

/* ------------------------------------------------------------------ */
/* Section 6: OTP handover                                            */
/* ------------------------------------------------------------------ */

test('POST /api/v1/orders/:id/handover/issue-otp - issues OTP for landed order', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    otp_challenges: {
      data: [],
      error: null
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/handover/issue-otp`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.recipient, 'buyer');
  assert.equal(res.body.demo, true);
  assert.ok(res.body.code);
  assert.equal(res.body.code.length, 6);
});

test('POST /api/v1/orders/:id/handover/issue-otp - non-landed order rejected', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'ACCEPTED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/handover/issue-otp`, {
    authorization: buyerToken()
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'HANDOVER_NOT_READY');
});

test('POST /api/v1/orders/:id/handover/verify - valid OTP completes order and posts settlement ledger', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code, pepper: 'test-pepper' });

  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future, null, { traveller_id: TRAVELLER_ID })],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    otp_challenges: {
      data: [{ id: 'ch-1', order_id: ORDER_ID, recipient_user_id: BUYER_ID, otp_hash: otpHash, attempts: 0, consumed_at: null, expires_at: future }],
      error: null
    },
    rpc: {
      transition_order: { data: { id: ORDER_ID, state: 'COMPLETED' }, error: null },
      post_ledger_transaction: { data: 'ledger-settle-1', error: null }
    }
  }));
  const origPepper = process.env.OTP_PEPPER;
  process.env.OTP_PEPPER = 'test-pepper';

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.state, 'COMPLETED');

  process.env.OTP_PEPPER = origPepper;
});

test('POST /api/v1/orders/:id/handover/verify - wrong OTP rejected', async (t) => {
  const code = '123456';
  const otpHash = hashOtp({ orderId: ORDER_ID, userId: BUYER_ID, code, pepper: 'test-pepper' });

  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'LANDED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    },
    otp_challenges: {
      data: [{ id: 'ch-1', order_id: ORDER_ID, recipient_user_id: BUYER_ID, otp_hash: otpHash, attempts: 0, consumed_at: null, expires_at: future }],
      error: null
    }
  }));
  const origPepper = process.env.OTP_PEPPER;
  process.env.OTP_PEPPER = 'test-pepper';

  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: '000000' });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'OTP_INVALID');

  process.env.OTP_PEPPER = origPepper;
});

test('POST /api/v1/orders/:id/handover/verify - already completed order returns duplicate', async (t) => {
  injectDb(createMockSupabase({
    orders: {
      data: [orderRow(ORDER_ID, BUYER_ID, 'COMPLETED', 42_000, future)],
      error: null
    },
    profiles: {
      data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')],
      error: null
    }
  }));
  const res = await rt.post(`/orders/${ORDER_ID}/handover/verify`, {
    authorization: buyerToken()
  }, { code: '123456' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.state, 'COMPLETED');
});

/* ------------------------------------------------------------------ */
/* Section 7: Webhooks                                                */
/* ------------------------------------------------------------------ */

test('POST /api/v1/webhooks/razorpay - invalid signature rejected', async (t) => {
  injectDb(createMockSupabase());
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {} } } });
  const res = await rt.post('/webhooks/razorpay', {
    'x-razorpay-signature': '00'.repeat(32),
    'x-razorpay-event-id': 'evt-bad-sig'
  }, body);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'INVALID_WEBHOOK_SIGNATURE');
});

test('POST /api/v1/webhooks/razorpay - missing event ID rejected', async (t) => {
  injectDb(createMockSupabase());
  const body = JSON.stringify({ event: 'payment.captured' });
  // Without RAZORPAY_WEBHOOK_SECRET configured, signature verification fails first
  const res = await rt.post('/webhooks/razorpay', {
    'x-razorpay-signature': '00'.repeat(32),
    'x-razorpay-event-id': 'evt-missing-id'
  }, body);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'INVALID_WEBHOOK_SIGNATURE');
});

/* ------------------------------------------------------------------ */
/* Section 8: Configuration                                           */
/* ------------------------------------------------------------------ */

test('GET /api/v1/config - returns mock payment config', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.get('/config');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mockPayments, true);
  assert.equal(res.body.realPaymentsEnabled, false);
  assert.equal(res.body.complianceApprovalRequired, true);
});

test('GET /api/v1/health - health check', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.get('/health');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, 'ok');
});
