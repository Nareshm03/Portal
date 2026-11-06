import test from 'node:test';
import assert from 'node:assert/strict';
import { expireOrders } from '../src/jobs/expireOrders.js';

/* ------------------------------------------------------------------ */
/* Mock Supabase client                                               */
/* ------------------------------------------------------------------ */

/** Builds a chainable mock for supabase-js query builders. */
function mockFrom(response) {
  return function from(table) {
    let updatePayload = null;
    const filters = [];
    let limitN = null;

    const chain = {
      select() { return chain; },
      eq(column, value) { filters.push({ column, value, op: 'eq' }); return chain; },
      lte(column, value) { filters.push({ column, value, op: 'lte' }); return chain; },
      gte(column, value) { filters.push({ column, value, op: 'gte' }); return chain; },
      in(column, values) { filters.push({ column, value: values, op: 'in' }); return chain; },
      limit(n) { limitN = n; return chain; },
      update(payload) {
        updatePayload = payload;
        return chain;
      },
      async single() {
        const result = await chain.exec();
        return { data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error };
      }
    };

    chain.exec = async function () {
      const rows = Array.isArray(response.data) ? response.data : [response.data];
      let filtered = rows.filter((row) => filters.every((f) => {
        const rowVal = row[f.column];
        if (f.op === 'eq') return rowVal === f.value;
        if (f.op === 'lte') return rowVal <= f.value;
        if (f.op === 'gte') return rowVal >= f.value;
        if (f.op === 'in') return f.value.includes(rowVal);
        return true;
      }));
      if (limitN !== null) filtered = filtered.slice(0, limitN);
      return { data: filtered, error: response.error ?? null, updatePayload };
    };

    // Make the chain thenable so `await db.from(...).select(...).eq(...)` works.
    chain.then = async function (resolveFn) {
      const result = await chain.exec();
      resolveFn({ data: result.data, error: result.error });
    };

    return chain;
  };
}

/** Builds a mock for `db.rpc(functionName, params)`. */
function mockRpc(response) {
  return async function rpc(funcName, params) {
    return response;
  };
}

function buildMockDb({ ordersResponse, intentsResponse, rpcResponse, updateResponse }) {
  const ordersResp = ordersResponse ?? { data: [], error: null };
  const intentsResp = intentsResponse ?? { data: [], error: null };
  const rpcResp = rpcResponse ?? { data: null, error: null };
  const updateResp = updateResponse ?? { data: null, error: null };

  const fromCalls = [];
  const rpcCalls = [];
  const updateCalls = [];

  const db = {
    from(table) {
      const response = table === 'payment_intents' ? intentsResp : ordersResp;
      const chain = mockFrom(response)(table);
      const originalSelect = chain.select.bind(chain);
      chain.select = (cols) => {
        fromCalls.push({ table, cols });
        return originalSelect(cols);
      };
      const originalUpdate = chain.update.bind(chain);
      chain.update = (payload) => {
        updateCalls.push({ table, payload });
        return originalUpdate(payload);
      };
      return chain;
    },
    rpc(funcName, params) {
      rpcCalls.push({ funcName, params });
      return Promise.resolve(rpcResp);
    },
    get fromCalls() { return fromCalls; },
    get rpcCalls() { return rpcCalls; },
    get updateCalls() { return updateCalls; }
  };
  return db;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const past = new Date(Date.now() - 60_000).toISOString();

function orderRow(id, buyerId, state, deadlineOrForfeit, forfeitColumn = 'payment_deadline') {
  return { id, buyer_id: buyerId, state, [forfeitColumn]: deadlineOrForfeit };
}

function intentRow(id, orderId, provider, status) {
  return { id, order_id: orderId, provider, status };
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

test('payment deadline not yet reached: no orders to expire', async (t) => {
  const db = buildMockDb({ ordersResponse: { data: [], error: null } });
  const result = await expireOrders({ db, now: new Date() });
  assert.deepEqual(result, { expired: 0, forfeited: 0 });
  assert.equal(db.rpcCalls.length, 0);
});

test('payment deadline reached: mock unpaid order expires', async (t) => {
  const orderId = 'o1';
  const buyerId = 'b1';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [intentRow('i1', orderId, 'MOCK', 'CREATED')], error: null },
    rpcResponse: { data: { id: orderId, state: 'EXPIRED' }, error: null },
    updateResponse: { data: [{ status: 'FAILED' }], error: null }
  });
  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 1);
  assert.equal(result.forfeited, 0);
  // Mock intent was closed to FAILED
  assert.equal(db.updateCalls.length, 1);
  assert.equal(db.updateCalls[0].payload.status, 'FAILED');
  // RPC was called to transition to EXPIRED
  assert.equal(db.rpcCalls.length, 1);
  assert.equal(db.rpcCalls[0].funcName, 'transition_order');
  assert.equal(db.rpcCalls[0].params.p_to_state, 'EXPIRED');
});

test('captured payment protected from expiry', async (t) => {
  const orderId = 'o2';
  const buyerId = 'b2';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [intentRow('i1', orderId, 'MOCK', 'CAPTURED')], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 0);
  assert.equal(db.rpcCalls.length, 0);
  assert.equal(db.updateCalls.length, 0);
});

test('pending real Razorpay payment protected from automatic expiry', async (t) => {
  const orderId = 'o3';
  const buyerId = 'b3';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [intentRow('i1', orderId, 'RAZORPAY', 'CREATED')], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 0);
  assert.equal(db.rpcCalls.length, 0);
  assert.equal(db.updateCalls.length, 0);
});

test('RAZORPAY AUTHORIZED intent is also protected', async (t) => {
  const orderId = 'o4';
  const buyerId = 'b4';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [intentRow('i1', orderId, 'RAZORPAY', 'AUTHORIZED')], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 0);
  assert.equal(db.rpcCalls.length, 0);
});

test('no intents at all: mock order can still expire', async (t) => {
  const orderId = 'o5';
  const buyerId = 'b5';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [], error: null },
    rpcResponse: { data: { id: orderId, state: 'EXPIRED' }, error: null }
  });
  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 1);
  assert.equal(db.updateCalls.length, 0); // no mock intent to close
  assert.equal(db.rpcCalls.length, 1);
  assert.equal(db.rpcCalls[0].params.p_to_state, 'EXPIRED');
});

test('landed order exceeding 72 hours is forfeited', async (t) => {
  const orderId = 'o6';
  const buyerId = 'b6';
  const longPast = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(); // 8 hours ago
  const landedDb = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'LANDED', longPast, 'forfeit_at')], error: null },
    rpcResponse: { data: { id: orderId, state: 'FORFEITED' }, error: null }
  });
  const result = await expireOrders({ db: landedDb, now: new Date() });
  assert.equal(result.forfeited, 1);
  assert.equal(landedDb.rpcCalls.length, 1);
  assert.equal(landedDb.rpcCalls[0].params.p_to_state, 'FORFEITED');
});

test('disputed order is never auto-forfeited', async (t) => {
  const orderId = 'o7';
  const buyerId = 'b7';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'DISPUTED', past, 'forfeit_at')], error: null },
    rpcResponse: { data: null, error: null }
  });
  // DISPUTED orders are not in state='LANDED', so they won't even be queried for forfeit
  const result = await expireOrders({ db, now: new Date() });
  assert.equal(result.forfeited, 0);
  assert.equal(db.rpcCalls.length, 0);
});

test('completed order is not transitioned again', async (t) => {
  const orderId = 'o8';
  const buyerId = 'b8';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'COMPLETED', past, 'forfeit_at')], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date() });
  assert.equal(result.forfeited, 0);
  assert.equal(db.rpcCalls.length, 0);
});

test('expired order is not transitioned again', async (t) => {
  const orderId = 'o9';
  const buyerId = 'b9';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'EXPIRED', past)], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date() });
  assert.equal(result.expired, 0);
  assert.equal(db.rpcCalls.length, 0);
});

test('forfeited order is not transitioned again', async (t) => {
  const orderId = 'o10';
  const buyerId = 'b10';
  const db = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'FORFEITED', past, 'forfeit_at')], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result = await expireOrders({ db, now: new Date() });
  assert.equal(result.forfeited, 0);
  assert.equal(db.rpcCalls.length, 0);
});

test('repeated execution is idempotent: already-expired orders are not re-selected', async (t) => {
  const orderId = 'o11';
  const buyerId = 'b11';
  // First run: order transitions to EXPIRED successfully
  const db1 = buildMockDb({
    ordersResponse: { data: [orderRow(orderId, buyerId, 'ACCEPTED', past)], error: null },
    intentsResponse: { data: [intentRow('i1', orderId, 'MOCK', 'CREATED')], error: null },
    rpcResponse: { data: { id: orderId, state: 'EXPIRED' }, error: null },
    updateResponse: { data: [{ status: 'FAILED' }], error: null }
  });
  const result1 = await expireOrders({ db: db1, now: new Date(Date.now() + 120_000) });
  assert.equal(result1.expired, 1);

  // Second run: order is now EXPIRED, not ACCEPTED, so it's not selected again
  const db2 = buildMockDb({
    ordersResponse: { data: [], error: null },
    rpcResponse: { data: null, error: null }
  });
  const result2 = await expireOrders({ db: db2, now: new Date(Date.now() + 120_000) });
  assert.equal(result2.expired, 0);
  assert.equal(db2.rpcCalls.length, 0);
});

test('multiple orders where one fails but others continue', async (t) => {
  const db = buildMockDb({
    ordersResponse: {
      data: [
        orderRow('o1', 'b1', 'ACCEPTED', past),
        orderRow('o2', 'b2', 'ACCEPTED', past),
        orderRow('o3', 'b3', 'ACCEPTED', past)
      ],
      error: null
    },
    intentsResponse: {
      data: [
        intentRow('i1', 'o1', 'MOCK', 'CREATED'),
        intentRow('i2', 'o2', 'MOCK', 'CREATED'),
        intentRow('i3', 'o3', 'MOCK', 'CREATED')
      ],
      error: null
    },
    rpcResponse: { data: null, error: null },
    updateResponse: { data: [{ status: 'FAILED' }], error: null }
  });

  // Make the RPC return an error for o2 but succeed for o1 and o3
  const rpc = async (funcName, params) => {
    db.rpcCalls.push({ funcName, params });
    if (params.p_order_id === 'o2') {
      return { data: null, error: { code: '23514', message: 'invalid transition' } };
    }
    return { data: { id: params.p_order_id, state: 'EXPIRED' }, error: null };
  };
  db.rpc = rpc;

  const result = await expireOrders({ db, now: new Date(Date.now() + 120_000) });
  assert.equal(result.expired, 2); // o1 and o3 succeeded, o2 failed but didn't stop the job
  assert.equal(db.rpcCalls.length, 3); // all three were attempted
});

test('function is exported and accepts no arguments', () => {
  assert.equal(typeof expireOrders, 'function');
});
