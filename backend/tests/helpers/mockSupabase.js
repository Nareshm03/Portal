/** Minimal fake Supabase client for route-level HTTP testing.
 *
 * Supports the query-builder chain used by the Portal API:
 *   from(table).select(cols).eq(col,val).lte(col,val).gte(col,val).in(col,[...]).limit(n).single()/maybeSingle()
 *   from(table).insert(payload)
 *   from(table).update(payload).eq(col,val).neq(col,val).is(col,null).select('*').single()
 *   from(table).delete().eq(col,val).is(col,null)
 *   rpc(funcName, params)
 *
 * Each table's canned response is provided via the `tables` map.
 */
export function createMockSupabase(tables = {}) {
  const callLog = { from: [], rpc: [], insert: [], update: [], delete: [] };

  function fromTable(tableName) {
    const response = tables[tableName] ?? { data: [], error: null };
    let selectCols = '*';
    const filters = [];
    let limitN = null;
    let offsetN = 0;
    let exactCount = false;
    let updatePayload = null;
    let insertPayload = null;

    const applyFilters = (rows) => rows.filter((row) => row != null && filters.every((f) => {
      const rowVal = row[f.column];
      if (f.op === 'eq') return rowVal === f.value;
      if (f.op === 'lte') return rowVal <= f.value;
      if (f.op === 'gte') return rowVal >= f.value;
      if (f.op === 'in') return f.value.includes(rowVal);
      if (f.op === 'neq') return rowVal !== f.value;
      if (f.op === 'is') return f.value === null ? rowVal === null : rowVal !== null;
      return true;
    }));

    const executeQuery = async () => {
      callLog.from.push({ table: tableName, cols: selectCols, filters });
      let rows = Array.isArray(response.data) ? response.data : [response.data];
      rows = applyFilters(rows);
      // Apply a pending update to the filtered rows (Supabase applies WHERE before SET).
      if (pendingUpdatePayload) {
        rows = rows.map((row) => ({ ...row, ...pendingUpdatePayload }));
        if (Array.isArray(response.data)) {
          response.data = response.data.map((row) =>
            rows.some((r) => r.id === row.id) ? { ...row, ...pendingUpdatePayload } : row
          );
        }
        pendingUpdatePayload = null;
      }
      // Capture the total matching count before any range/limit slicing.
      const totalCount = rows.length;
      if (offsetN > 0) rows = rows.slice(offsetN);
      if (limitN !== null) rows = rows.slice(0, limitN);
      // If selectCols contains '*', return full rows; otherwise project columns
      const cols = selectCols.split(',').map((c) => c.trim());
      const projected = cols.includes('*')
        ? rows
        : rows.map((r) => {
            const out = {};
            for (const col of cols) out[col] = r[col];
            return out;
          });
      return { data: projected, error: response.error ?? null, count: exactCount ? totalCount : null };
    };

    const chain = {
      select(cols, options) {
        selectCols = cols ?? '*';
        if (options?.count === 'exact') exactCount = true;
        return chain;
      },
      eq(column, value) { filters.push({ column, value, op: 'eq' }); return chain; },
      lte(column, value) { filters.push({ column, value, op: 'lte' }); return chain; },
      gte(column, value) { filters.push({ column, value, op: 'gte' }); return chain; },
      in(column, values) { filters.push({ column, value: values, op: 'in' }); return chain; },
      neq(column, value) { filters.push({ column, value, op: 'neq' }); return chain; },
      is(column, value) { filters.push({ column, value, op: 'is' }); return chain; },
      or() { return chain; },
      order() { return chain; },
      limit(n) { limitN = n; return chain; },
      range(from, to) { limitN = to - from + 1; offsetN = from; return chain; },
      maybeSingle() {
        return executeQuery().then(({ data, error }) => {
          const singleData = Array.isArray(data)
            ? data.length === 1 ? data[0] : null
            : data;
          return { data: singleData, error };
        });
      },
      single() {
        return this.maybeSingle();
      },
      then(onFulfilled) {
        return executeQuery().then(onFulfilled);
      }
    };

    let pendingUpdatePayload = null;

    chain.update = (payload) => {
      callLog.update.push({ table: tableName, payload, filters });
      pendingUpdatePayload = payload;
      return chain;
    };

    chain.insert = (payload) => {
      callLog.insert.push({ table: tableName, payload });
      insertPayload = payload;
      if (!Array.isArray(response.data)) response.data = [];
      // Generate a fallback id if the payload doesn't include one (DB-generated scenario).
      const row = { ...payload, id: payload.id ?? `mock-id-${response.data.length + 1}` };
      response.data.push(row);
      return chain;
    };

    chain.delete = () => {
      callLog.delete.push({ table: tableName, filters });
      // Apply deletion synchronously to the data â€” chain stays thenable for awaiting.
      if (Array.isArray(response.data)) {
        response.data = response.data.filter((row) => applyFilters([row]).length === 0);
      }
      return chain;
    };

    return chain;
  }

  const authGetUser = tables.authGetUser ?? (async (token) => {
    const rawToken = String(token ?? '').replace(/^Bearer\s+/i, '');
    const match = rawToken.match(/^(.+?)(?:-token)?$/);
    const userId = match ? match[1] : 'mock-user-id';
    return { data: { user: { id: userId, email: `${userId}@test.com` } }, error: null };
  });

  const db = {
    from(tableName) {
      return fromTable(tableName);
    },
    async rpc(funcName, params) {
      callLog.rpc.push({ funcName, params });
      const response = tables.rpc ?? {};
      let result = response[funcName] ?? { data: null, error: null };
      if (typeof result === 'function') result = await result(params);

      // Simulate RPC side effects so routes that re-query affected rows see
      // consistent state and enriched return values.
      if (funcName === 'accept_quote' && result && result.error == null && result.data != null) {
        if (!tables.orders || !Array.isArray(tables.orders.data)) {
          tables.orders = { data: Array.isArray(tables.orders?.data) ? tables.orders.data : [], error: null };
        }
        const id = result.data;
        if (!tables.orders.data.some((r) => r && r.id === id)) {
          tables.orders.data.push({
            id,
            state: 'ACCEPTED',
            buyer_id: params?.p_buyer_id ?? null,
            traveller_id: params?.p_traveller_id ?? null,
            upfront_paise: params?.p_upfront_paise ?? null,
            payment_deadline: params?.p_payment_deadline ?? null,
            balance_paise: params?.p_balance_paise ?? null,
            total_paise: params?.p_total_paise ?? null,
            subtotal_paise: params?.p_subtotal_paise ?? null,
            platform_fee_paise: params?.p_platform_fee_paise ?? null,
            duty_paise: params?.p_duty_paise ?? null,
            traveller_reward_paise: params?.p_traveller_reward_paise ?? null
          });
        }
      }

      if (funcName === 'transition_order' && result && result.error == null) {
        const id = params?.p_order_id;
        const toState = params?.p_to_state;
        if (tables.orders && Array.isArray(tables.orders.data)) {
          const row = tables.orders.data.find((r) => r && r.id === id);
          if (row && toState) row.state = toState;
        }
        if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
          const row = (tables.orders && Array.isArray(tables.orders.data))
            ? tables.orders.data.find((r) => r && r.id === id) : null;
          result = {
            ...result,
            data: {
              ...(row || {}),
              ...result.data,
              id: result.data.id ?? id,
              state: toState ?? result.data.state
            }
          };
        }
      }

      return result;
    },
    auth: {
      getUser: authGetUser
    },
    get callLog() { return callLog; },
    setResponse(tableName, response) {
      tables[tableName] = response;
    },
    setRpcResponse(funcName, result) {
      if (!tables.rpc) tables.rpc = {};
      tables.rpc[funcName] = result;
    },
    setAuthGetUser(fn) {
      tables.authGetUser = fn;
    }
  };
  return db;
}

/* ------------------------------------------------------------------ */
/* Test data helpers                                                  */
/* ------------------------------------------------------------------ */

export const past = new Date(Date.now() - 60_000).toISOString();
export const future = new Date(Date.now() + 60_000).toISOString();

// Generate UUIDv4-compatible IDs for z.string().uuid() validation
// UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y = 8,9,a,b)
function testUuid(n) {
  const h = String(n).padStart(8, '0');
  return `${h}-1111-4${'1'.repeat(3)}-8${'1'.repeat(3)}-${'1'.repeat(12)}`;
}

export function orderRow(id, buyerId, state, upfront, paymentDeadline, forfeitAt, extra = {}) {
  return {
    id, buyer_id: buyerId, state, upfront_paise: upfront,
    payment_deadline: paymentDeadline || future, forfeit_at: forfeitAt || null, ...extra
  };
}

export function intentRow(id, orderId, buyerId, provider, status, amount, providerOrderId) {
  return {
    id, order_id: orderId, buyer_id: buyerId, provider, status,
    amount_paise: amount || 42_000, currency: 'INR',
    provider_order_id: providerOrderId || `prov_${id}`,
    idempotency_key: `idem_${id}`
  };
}

export function quoteRow(id, requestId, tripId, travellerId, status = 'ACTIVE', expiresAt = future, dutyApproved = true, buyerId = null) {
  return {
    id, request_id: requestId, trip_id: tripId, traveller_id: travellerId,
    item_price_minor: 100_000, item_currency: 'USD', traveller_reward_paise: 8_000,
    fx_rate: '83.500000', fx_source: 'ENV_CONFIG', fx_timestamp: new Date().toISOString(),
    indicative_duty_paise: dutyApproved ? 12_000 : null,
    duty_source: dutyApproved ? 'manual_hs_8517' : null,
    duty_reviewed_by: dutyApproved ? 'reviewer-1' : null,
    duty_reviewed_at: dutyApproved ? new Date().toISOString() : null,
    duty_assessment_reference: dutyApproved ? 'REF-001' : null,
    platform_fee_bps: 500, status, expires_at: expiresAt,
    // Embedded request object used by the quote-acceptance route.
    // buyer_id defaults to requestId only as a last resort; callers should pass buyerId explicitly.
    requests: {
      id: requestId,
      buyer_id: buyerId ?? requestId,
      compliance_status: 'APPROVED',
      status: 'OPEN',
    }
  };
}

export function requestRow(id, buyerId, status = 'OPEN', complianceStatus = 'APPROVED') {
  return { id, buyer_id: buyerId, status, compliance_status: complianceStatus };
}

export function tripRow(id, travellerId, status = 'ACTIVE', extra = {}) {
  return {
    id, traveller_id: travellerId, status,
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    capacity_kg: 10, ...extra
  };
}

export function profileRow(id, role = 'buyer', accountStatus = 'ACTIVE', kycStatus = 'VERIFIED', phoneE164 = null, phoneVerified = false) {
  return { id, role, account_status: accountStatus, kyc_status: kycStatus, full_name: 'Test User', phone_e164: phoneE164, phone_verified: phoneVerified };
}

export { testUuid };
