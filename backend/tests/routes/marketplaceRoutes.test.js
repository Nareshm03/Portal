/**
 * Route-level tests for marketplace, KYC and admin endpoints.
 *
 * Covers the missing route coverage identified in the Backend Completion Matrix:
 *   - Buyer requests (POST /requests, GET /requests/mine)
 *   - Traveller trips (POST /trips, GET /trips/mine)
 *   - Request matching (GET /requests?matching=me)
 *   - Quote creation and listing (POST /requests/:id/quotes, GET /requests/:id/quotes)
 *   - Admin compliance review (POST /admin/requests/:id/review)
 *   - Admin duty assessment (POST /admin/quotes/:id/duty-assessment)
 *   - Admin trip activation (POST /admin/trips/:id/activate)
 *   - KYC submit and profile administration (POST /kyc/submit, POST /admin/profiles/:id/role, POST /admin/profiles/:id/kyc-review)
 *
 * These tests exercise the actual Express route handlers via createRouteTester
 * with an injected fake Supabase client. No live database.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockSupabase,
  requestRow,
  tripRow,
  profileRow,
  quoteRow,
  testUuid,
  future,
  past,
} from '../helpers/mockSupabase.js';
import { createRouteTester, injectDb } from '../helpers/routeTester.js';

const rt = createRouteTester();

/* ------------------------------------------------------------------ */
/* Test data                                                          */
/* ------------------------------------------------------------------ */

const BUYER_ID = testUuid(1);
const TRAVELLER_ID = testUuid(2);
const ADMIN_ID = testUuid(10);
const COMPLIANCE_REVIEWER_ID = testUuid(11);
const SUSPENDED_ID = testUuid(12);
const UNVERIFIED_TRAVELLER_ID = testUuid(13);
const OTHER_TRAVELLER_ID = testUuid(14);
const STRANGER_ID = testUuid(99);

const REQUEST_ID = testUuid(20);
const TRIP_ID = testUuid(21);
const QUOTE_ID = testUuid(22);

function buyerToken() { return `Bearer ${BUYER_ID}-token`; }
function travellerToken() { return `Bearer ${TRAVELLER_ID}-token`; }
function adminToken() { return `Bearer ${ADMIN_ID}-token`; }
function complianceReviewerToken() { return `Bearer ${COMPLIANCE_REVIEWER_ID}-token`; }
function suspendedToken() { return `Bearer ${SUSPENDED_ID}-token`; }
function unverifiedTravellerToken() { return `Bearer ${UNVERIFIED_TRAVELLER_ID}-token`; }
function otherTravellerToken() { return `Bearer ${OTHER_TRAVELLER_ID}-token`; }
function strangerToken() { return `Bearer ${STRANGER_ID}-token`; }

const validRequestBody = {
  originCountry: 'US',
  originAirportCode: 'JFK',
  destinationCountry: 'IN',
  destinationAirportCode: 'BLR',
  neededBy: future,
  productTitle: 'Noise-cancelling headphones',
  productCategory: 'consumer_electronics',
  quantity: 1,
  fulfilmentMode: 'PASSENGER_BAGGAGE',
  isForThirdParty: true,
};

const validTripBody = {
  originCountry: 'US',
  originAirportCode: 'JFK',
  destinationCountry: 'IN',
  destinationAirportCode: 'BLR',
  departureAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  arrivalAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  capacityKg: 10,
};

const validQuoteBody = {
  tripId: TRIP_ID,
  itemPriceMinor: 100_000,
  itemCurrency: 'USD',
  travellerRewardPaise: 8_000,
};

/* ================================================================== */
/* Section 1: Buyer requests — POST /requests                         */
/* ================================================================== */

test('POST /requests - buyer creates valid request, returns 201 with PENDING_REVIEW', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, validRequestBody);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.buyer_id, BUYER_ID);
  assert.equal(res.body.data.status, 'PENDING_REVIEW');
  assert.equal(res.body.data.compliance_status, 'REVIEW_REQUIRED');
  assert.ok(res.body.data.id);
});

test('POST /requests - blocked category returns REJECTED status', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, {
    ...validRequestBody,
    productCategory: 'firearms',
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.compliance_status, 'REJECTED');
  assert.equal(res.body.data.status, 'REJECTED');
});

test('POST /requests - third-party baggage without HS code returns REVIEW_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, {
    ...validRequestBody,
    productCategory: 'consumer_electronics',
    hsCode: undefined,
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.compliance_status, 'REVIEW_REQUIRED');
  assert.equal(res.body.data.status, 'PENDING_REVIEW');
});

test('POST /requests - origin equals destination rejected with 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, {
    ...validRequestBody,
    destinationAirportCode: 'JFK',
  });
  assert.equal(res.statusCode, 400);
});

test('POST /requests - missing productTitle rejected with 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, {
    ...validRequestBody,
    productTitle: '',
  });
  assert.equal(res.statusCode, 400);
});

test('POST /requests - neededBy in the past rejected with 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/requests', { authorization: buyerToken() }, {
    ...validRequestBody,
    neededBy: past,
  });
  assert.equal(res.statusCode, 400);
});

test('POST /requests - unauthenticated returns 401', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.post('/requests', {}, validRequestBody);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

test('POST /requests - traveller role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/requests', { authorization: travellerToken() }, validRequestBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /requests - suspended account returns 403 ACCOUNT_RESTRICTED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(SUSPENDED_ID, 'buyer', 'SUSPENDED', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/requests', { authorization: suspendedToken() }, validRequestBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ACCOUNT_RESTRICTED');
});

/* ================================================================== */
/* Section 2: Buyer requests — GET /requests/mine                     */
/* ================================================================== */

test('GET /requests/mine - buyer sees own requests', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')],
      error: null,
    },
  }));
  const res = await rt.get('/requests/mine', { authorization: buyerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].id, REQUEST_ID);
});

test('GET /requests/mine - buyer with no requests returns empty array', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.get('/requests/mine', { authorization: buyerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /requests/mine - traveller role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/requests/mine', { authorization: travellerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('GET /requests/mine - unauthenticated returns 401', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.get('/requests/mine');
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

/* ================================================================== */
/* Section 3: Traveller trips — POST /trips                           */
/* ================================================================== */

test('POST /trips - traveller with VERIFIED KYC creates DRAFT trip, returns 201', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [], error: null },
  }));
  const res = await rt.post('/trips', { authorization: travellerToken() }, validTripBody);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.traveller_id, TRAVELLER_ID);
  assert.equal(res.body.data.status, 'DRAFT');
  assert.ok(res.body.data.id);
});

test('POST /trips - traveller with NOT_SUBMITTED KYC returns 403 KYC_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(UNVERIFIED_TRAVELLER_ID, 'traveller', 'ACTIVE', 'NOT_SUBMITTED')], error: null },
  }));
  const res = await rt.post('/trips', { authorization: unverifiedTravellerToken() }, validTripBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

test('POST /trips - traveller with PENDING KYC returns 403 KYC_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(UNVERIFIED_TRAVELLER_ID, 'traveller', 'ACTIVE', 'PENDING_REVIEW')], error: null },
  }));
  const res = await rt.post('/trips', { authorization: unverifiedTravellerToken() }, validTripBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

test('POST /trips - arrival before departure rejected with 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/trips', { authorization: travellerToken() }, {
    ...validTripBody,
    arrivalAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    departureAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(res.statusCode, 400);
});

test('POST /trips - departure in the past rejected with 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/trips', { authorization: travellerToken() }, {
    ...validTripBody,
    departureAt: past,
  });
  assert.equal(res.statusCode, 400);
});

test('POST /trips - buyer role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post('/trips', { authorization: buyerToken() }, validTripBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /trips - unauthenticated returns 401', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.post('/trips', {}, validTripBody);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

/* ================================================================== */
/* Section 4: Traveller trips — GET /trips/mine                       */
/* ================================================================== */

test('GET /trips/mine - traveller sees own trips', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: {
      data: [tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT')],
      error: null,
    },
  }));
  const res = await rt.get('/trips/mine', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].id, TRIP_ID);
});

test('GET /trips/mine - traveller with no trips returns empty array', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [], error: null },
  }));
  const res = await rt.get('/trips/mine', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /trips/mine - buyer role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/trips/mine', { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

/* ================================================================== */
/* Section 5: Matching — GET /requests?matching=me                    */
/* ================================================================== */

test('GET /requests?matching=me - traveller with matching ACTIVE trip sees APPROVED OPEN requests', async (t) => {
  // Trip: JFK -> BLR, departing in 7 days, arriving in 8 days
  // Request: JFK -> BLR, neededBy in 10 days (after arrival)
  const matchingTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const matchingRequest = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [matchingTrip], error: null },
    requests: { data: [matchingRequest], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].id, REQUEST_ID);
});

test('GET /requests?matching=me - request with REVIEW_REQUIRED compliance is excluded', async (t) => {
  const matchingTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const unreviewedRequest = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'REVIEW_REQUIRED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [matchingTrip], error: null },
    requests: { data: [unreviewedRequest], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /requests?matching=me - request with CLOSED status is excluded', async (t) => {
  const matchingTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const closedRequest = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'CLOSED', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [matchingTrip], error: null },
    requests: { data: [closedRequest], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /requests?matching=me - traveller with no ACTIVE trips returns empty array', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

test('GET /requests?matching=me - missing matching parameter returns 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/requests', { authorization: travellerToken() });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'MATCHING_FILTER_REQUIRED');
});

test('GET /requests?matching=me - traveller with NOT_VERIFIED KYC returns 403 KYC_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(UNVERIFIED_TRAVELLER_ID, 'traveller', 'ACTIVE', 'SUBMITTED')], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: unverifiedTravellerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

test('GET /requests?matching=me - buyer role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('GET /requests?matching=me - route mismatch excludes request', async (t) => {
  const mismatchedTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'AE', destination_airport_code: 'DXB',
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const mismatchedRequest = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [mismatchedTrip], error: null },
    requests: { data: [mismatchedRequest], error: null },
  }));
  const res = await rt.get('/requests?matching=me', { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, []);
});

/* ================================================================== */
/* Section 6: Quotes — POST /requests/:id/quotes                      */
/* ================================================================== */

test('POST /requests/:id/quotes - traveller with active matching trip creates quote, returns 201', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const trip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    trips: { data: [trip], error: null },
    quotes: { data: [], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.request_id, REQUEST_ID);
  assert.equal(res.body.data.traveller_id, TRAVELLER_ID);
  assert.equal(res.body.data.status, 'ACTIVE');
  assert.ok(res.body.data.id);
  assert.ok(res.body.preview);
});

test('POST /requests/:id/quotes - traveller with NOT_VERIFIED KYC returns 403 KYC_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(UNVERIFIED_TRAVELLER_ID, 'traveller', 'ACTIVE', 'SUBMITTED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: unverifiedTravellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'KYC_REQUIRED');
});

test('POST /requests/:id/quotes - request not OPEN returns 409 REQUEST_NOT_OPEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'MATCHED', 'APPROVED')], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'REQUEST_NOT_OPEN');
});

test('POST /requests/:id/quotes - request not APPROVED compliance returns 409 COMPLIANCE_REVIEW_REQUIRED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'REVIEW_REQUIRED')], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'COMPLIANCE_REVIEW_REQUIRED');
});

test('POST /requests/:id/quotes - trip not active returns 404 ACTIVE_TRIP_REQUIRED', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const draftTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT');
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    trips: { data: [draftTrip], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'ACTIVE_TRIP_REQUIRED');
});

test('POST /requests/:id/quotes - trip route mismatch returns 409 TRIP_ROUTE_MISMATCH', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'IN', destination_airport_code: 'BLR',
    needed_by: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const mismatchedTrip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE', {
    origin_country: 'US', origin_airport_code: 'JFK',
    destination_country: 'AE', destination_airport_code: 'DXB',
    departure_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    arrival_at: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
  });
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    trips: { data: [mismatchedTrip], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'TRIP_ROUTE_MISMATCH');
});

test('POST /requests/:id/quotes - buyer role returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: buyerToken() }, validQuoteBody);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /requests/:id/quotes - invalid tripId returns 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED')], error: null },
  }));
  const res = await rt.post(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() }, {
    ...validQuoteBody,
    tripId: 'not-a-uuid',
  });
  assert.equal(res.statusCode, 400);
});

/* ================================================================== */
/* Section 7: Quotes — GET /requests/:id/quotes                       */
/* ================================================================== */

test('GET /requests/:id/quotes - buyer owner sees all quotes for request', async (t) => {
  const quotes = [
    quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID),
    { ...quoteRow(testUuid(23), REQUEST_ID, TRIP_ID, OTHER_TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID) },
  ];
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED' }],
      error: null,
    },
    quotes: { data: quotes, error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 2);
});

test('GET /requests/:id/quotes - traveller sees only own quotes', async (t) => {
  const quotes = [
    quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID),
    { ...quoteRow(testUuid(23), REQUEST_ID, TRIP_ID, OTHER_TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID) },
  ];
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED' }],
      error: null,
    },
    quotes: { data: quotes, error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: travellerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].traveller_id, TRAVELLER_ID);
});

test('GET /requests/:id/quotes - admin sees all quotes', async (t) => {
  const quotes = [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID)];
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED' }],
      error: null,
    },
    quotes: { data: quotes, error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
});

test('GET /requests/:id/quotes - compliance_reviewer sees all quotes', async (t) => {
  const quotes = [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID)];
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(COMPLIANCE_REVIEWER_ID, 'compliance_reviewer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED' }],
      error: null,
    },
    quotes: { data: quotes, error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: complianceReviewerToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
});

test('GET /requests/:id/quotes - non-owner traveller sees only own quotes (empty if none)', async (t) => {
  const quotes = [
    quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID),
  ];
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(OTHER_TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED')], error: null },
    requests: {
      data: [{ id: REQUEST_ID, buyer_id: BUYER_ID, compliance_status: 'APPROVED' }],
      error: null,
    },
    quotes: { data: quotes, error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: otherTravellerToken() });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.equal(res.body.data.length, 0, 'Non-owner traveller should see no quotes for this request');
});

test('GET /requests/:id/quotes - request not found returns 404', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.get(`/requests/${REQUEST_ID}/quotes`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'REQUEST_NOT_FOUND');
});

/* ================================================================== */
/* Section 8: Admin compliance review — POST /admin/requests/:id/review */
/* ================================================================== */

test('POST /admin/requests/:id/review - admin APPROVES request with hsCode, status becomes OPEN', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED'),
    hs_code: '851762',
    fulfilment_mode: 'FORMAL_IMPORT',
    is_for_third_party: false,
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'APPROVED',
    reason: 'Verified HS code and formal import route.',
    complianceReference: 'REF-2026-001',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.compliance_status, 'APPROVED');
  assert.equal(res.body.data.status, 'OPEN');
});

test('POST /admin/requests/:id/review - admin REJECTS request, status becomes REJECTED', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED'),
    hs_code: '851762',
    fulfilment_mode: 'FORMAL_IMPORT',
    is_for_third_party: false,
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'REJECTED',
    reason: 'Item does not meet import eligibility criteria.',
    complianceReference: 'REF-2026-002',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.compliance_status, 'REJECTED');
  assert.equal(res.body.data.status, 'REJECTED');
});

test('POST /admin/requests/:id/review - compliance_reviewer can APPROVE', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED'),
    hs_code: '851762',
    fulfilment_mode: 'FORMAL_IMPORT',
    is_for_third_party: false,
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(COMPLIANCE_REVIEWER_ID, 'compliance_reviewer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: complianceReviewerToken() }, {
    decision: 'APPROVED',
    reason: 'Verified HS code and formal import route.',
    complianceReference: 'REF-2026-003',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, 'OPEN');
});

test('POST /admin/requests/:id/review - already reviewed request returns 409 ALREADY_REVIEWED', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'OPEN', 'APPROVED'),
    hs_code: '851762',
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'REJECTED',
    reason: 'Duplicate review attempt.',
    complianceReference: 'REF-2026-004',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'ALREADY_REVIEWED');
});

test('POST /admin/requests/:id/review - APPROVED without hsCode returns 409 HS_CODE_REQUIRED', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED'),
    hs_code: null,
    fulfilment_mode: 'FORMAL_IMPORT',
    is_for_third_party: false,
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'APPROVED',
    reason: 'Missing HS code.',
    complianceReference: 'REF-2026-005',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'HS_CODE_REQUIRED');
});

test('POST /admin/requests/:id/review - third-party baggage under PASSENGER_BAGGAGE returns 409', async (t) => {
  const request = {
    ...requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED'),
    hs_code: '851762',
    fulfilment_mode: 'PASSENGER_BAGGAGE',
    is_for_third_party: true,
  };
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [request], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'APPROVED',
    reason: 'Third-party baggage not supported.',
    complianceReference: 'REF-2026-006',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'THIRD_PARTY_BAGGAGE_NOT_SUPPORTED');
});

test('POST /admin/requests/:id/review - buyer returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [requestRow(REQUEST_ID, BUYER_ID, 'PENDING_REVIEW', 'REVIEW_REQUIRED')], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: buyerToken() }, {
    decision: 'APPROVED',
    reason: 'Unauthorized attempt.',
    complianceReference: 'REF-2026-007',
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /admin/requests/:id/review - request not found returns 404', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    requests: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/requests/${REQUEST_ID}/review`, { authorization: adminToken() }, {
    decision: 'APPROVED',
    reason: 'Non-existent request.',
    complianceReference: 'REF-2026-008',
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'REQUEST_NOT_FOUND');
});

/* ================================================================== */
/* Section 9: Admin duty assessment — POST /admin/quotes/:id/duty-assessment */
/* ================================================================== */

test('POST /admin/quotes/:id/duty-assessment - admin sets duty on ACTIVE quote, returns 200', async (t) => {
  const quote = quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, false, BUYER_ID);
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    quotes: { data: [quote], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/quotes/${QUOTE_ID}/duty-assessment`, { authorization: adminToken() }, {
    dutyAmountPaise: 12_000,
    source: 'manual_hs_8517',
    assessmentReference: 'REF-DUTY-001',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.indicative_duty_paise, 12_000);
  assert.equal(res.body.data.duty_source, 'manual_hs_8517');
  assert.equal(res.body.data.duty_assessment_reference, 'REF-DUTY-001');
});

test('POST /admin/quotes/:id/duty-assessment - compliance_reviewer can set duty', async (t) => {
  const quote = quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, false, BUYER_ID);
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(COMPLIANCE_REVIEWER_ID, 'compliance_reviewer', 'ACTIVE', 'VERIFIED')], error: null },
    quotes: { data: [quote], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/quotes/${QUOTE_ID}/duty-assessment`, { authorization: complianceReviewerToken() }, {
    dutyAmountPaise: 8_500,
    source: 'customs_tariff',
    assessmentReference: 'REF-DUTY-002',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.indicative_duty_paise, 8_500);
});

test('POST /admin/quotes/:id/duty-assessment - non-ACTIVE quote returns 409 QUOTE_NOT_ACTIVE', async (t) => {
  const quote = quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACCEPTED', future, true, BUYER_ID);
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    quotes: { data: [quote], error: null },
  }));
  const res = await rt.post(`/admin/quotes/${QUOTE_ID}/duty-assessment`, { authorization: adminToken() }, {
    dutyAmountPaise: 12_000,
    source: 'manual_hs_8517',
    assessmentReference: 'REF-DUTY-003',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'QUOTE_NOT_ACTIVE');
});

test('POST /admin/quotes/:id/duty-assessment - buyer returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    quotes: { data: [quoteRow(QUOTE_ID, REQUEST_ID, TRIP_ID, TRAVELLER_ID, 'ACTIVE', future, true, BUYER_ID)], error: null },
  }));
  const res = await rt.post(`/admin/quotes/${QUOTE_ID}/duty-assessment`, { authorization: buyerToken() }, {
    dutyAmountPaise: 12_000,
    source: 'manual_hs_8517',
    assessmentReference: 'REF-DUTY-004',
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /admin/quotes/:id/duty-assessment - quote not found returns 404', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    quotes: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/quotes/${QUOTE_ID}/duty-assessment`, { authorization: adminToken() }, {
    dutyAmountPaise: 12_000,
    source: 'manual_hs_8517',
    assessmentReference: 'REF-DUTY-005',
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'QUOTE_NOT_FOUND');
});

/* ================================================================== */
/* Section 10: Admin trip activation — POST /admin/trips/:id/activate */
/* ================================================================== */

test('POST /admin/trips/:id/activate - admin activates cleared traveller DRAFT trip, returns 200', async (t) => {
  const trip = tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT');
  injectDb(createMockSupabase({
    profiles: {
      data: [
        profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED'),
        profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED'),
      ],
      error: null,
    },
    trips: { data: [trip], error: null },
    audit_logs: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: adminToken() });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, 'ACTIVE');
});

test('POST /admin/trips/:id/activate - traveller not cleared (SUSPENDED) returns 409 TRAVELLER_NOT_CLEARED', async (t) => {
  const trip = tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT');
  injectDb(createMockSupabase({
    profiles: {
      data: [
        profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED'),
        profileRow(TRAVELLER_ID, 'traveller', 'SUSPENDED', 'VERIFIED'),
      ],
      error: null,
    },
    trips: { data: [trip], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: adminToken() });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'TRAVELLER_NOT_CLEARED');
});

test('POST /admin/trips/:id/activate - traveller KYC not VERIFIED returns 409 TRAVELLER_NOT_CLEARED', async (t) => {
  const trip = tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT');
  injectDb(createMockSupabase({
    profiles: {
      data: [
        profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED'),
        profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'SUBMITTED'),
      ],
      error: null,
    },
    trips: { data: [trip], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: adminToken() });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'TRAVELLER_NOT_CLEARED');
});

test('POST /admin/trips/:id/activate - trip not DRAFT returns 409 TRIP_NOT_DRAFT', async (t) => {
  const trip = tripRow(TRIP_ID, TRAVELLER_ID, 'ACTIVE');
  injectDb(createMockSupabase({
    profiles: {
      data: [
        profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED'),
        profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'VERIFIED'),
      ],
      error: null,
    },
    trips: { data: [trip], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: adminToken() });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'TRIP_NOT_DRAFT');
});

test('POST /admin/trips/:id/activate - buyer returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [tripRow(TRIP_ID, TRAVELLER_ID, 'DRAFT')], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: buyerToken() });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /admin/trips/:id/activate - trip not found returns 404', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    trips: { data: [], error: null },
  }));
  const res = await rt.post(`/admin/trips/${TRIP_ID}/activate`, { authorization: adminToken() });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, 'TRIP_NOT_FOUND');
});

/* ================================================================== */
/* Section 11: KYC submit — POST /kyc/submit                          */
/* ================================================================== */

test('POST /kyc/submit - buyer submits KYC, returns 202 with SUBMITTED status', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'NOT_SUBMITTED')], error: null },
  }));
  const res = await rt.post('/kyc/submit', { authorization: buyerToken() }, {
    providerReference: 'kyc-ref-2026-001',
  });
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.data.kyc_status, 'SUBMITTED');
});

test('POST /kyc/submit - traveller submits KYC, returns 202', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(TRAVELLER_ID, 'traveller', 'ACTIVE', 'NOT_SUBMITTED')], error: null },
  }));
  const res = await rt.post('/kyc/submit', { authorization: travellerToken() }, {
    providerReference: 'kyc-ref-2026-002',
  });
  assert.equal(res.statusCode, 202);
  assert.equal(res.body.data.kyc_status, 'SUBMITTED');
});

test('POST /kyc/submit - providerReference too short returns 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'NOT_SUBMITTED')], error: null },
  }));
  const res = await rt.post('/kyc/submit', { authorization: buyerToken() }, {
    providerReference: 'short',
  });
  assert.equal(res.statusCode, 400);
});

test('POST /kyc/submit - unauthenticated returns 401', async (t) => {
  injectDb(createMockSupabase());
  const res = await rt.post('/kyc/submit', {}, { providerReference: 'kyc-ref-2026-003' });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

/* ================================================================== */
/* Section 12: Admin profile role — POST /admin/profiles/:id/role     */
/* ================================================================== */

test('POST /admin/profiles/:id/role - admin provisions traveller role, returns 200', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      provision_profile_role: { data: { id: BUYER_ID, role: 'traveller' }, error: null },
    },
  }));
  const res = await rt.post(`/admin/profiles/${BUYER_ID}/role`, { authorization: adminToken() }, {
    role: 'traveller',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data);
  assert.ok(res.body.message.includes('Traveller role assigned'));
});

test('POST /admin/profiles/:id/role - admin provisions buyer role, returns 200', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      provision_profile_role: { data: { id: TRAVELLER_ID, role: 'buyer' }, error: null },
    },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/role`, { authorization: adminToken() }, {
    role: 'buyer',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.message.includes('Buyer role assigned'));
});

test('POST /admin/profiles/:id/role - buyer returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/role`, { authorization: buyerToken() }, {
    role: 'traveller',
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /admin/profiles/:id/role - invalid role returns 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post(`/admin/profiles/${BUYER_ID}/role`, { authorization: adminToken() }, {
    role: 'admin',
  });
  assert.equal(res.statusCode, 400);
});

test('POST /admin/profiles/:id/role - RPC error returns 409 PROFILE_PROVISION_FAILED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      provision_profile_role: { data: null, error: { code: '42501', message: 'insufficient_privilege' } },
    },
  }));
  const res = await rt.post(`/admin/profiles/${BUYER_ID}/role`, { authorization: adminToken() }, {
    role: 'traveller',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'PROFILE_PROVISION_FAILED');
});

/* ================================================================== */
/* Section 13: Admin KYC review — POST /admin/profiles/:id/kyc-review */
/* ================================================================== */

test('POST /admin/profiles/:id/kyc-review - admin VERIFIES traveller KYC, returns 200', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      review_traveller_kyc: { data: { id: TRAVELLER_ID, kyc_status: 'VERIFIED' }, error: null },
    },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/kyc-review`, { authorization: adminToken() }, {
    decision: 'VERIFIED',
    providerReference: 'kyc-provider-ref-001',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data);
});

test('POST /admin/profiles/:id/kyc-review - admin REJECTS traveller KYC, returns 200', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      review_traveller_kyc: { data: { id: TRAVELLER_ID, kyc_status: 'REJECTED' }, error: null },
    },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/kyc-review`, { authorization: adminToken() }, {
    decision: 'REJECTED',
    providerReference: 'kyc-provider-ref-002',
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data);
});

test('POST /admin/profiles/:id/kyc-review - buyer returns 403 ROLE_FORBIDDEN', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(BUYER_ID, 'buyer', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/kyc-review`, { authorization: buyerToken() }, {
    decision: 'VERIFIED',
    providerReference: 'kyc-provider-ref-003',
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'ROLE_FORBIDDEN');
});

test('POST /admin/profiles/:id/kyc-review - providerReference too short returns 400', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/kyc-review`, { authorization: adminToken() }, {
    decision: 'VERIFIED',
    providerReference: 'short',
  });
  assert.equal(res.statusCode, 400);
});

test('POST /admin/profiles/:id/kyc-review - RPC error returns 409 KYC_REVIEW_FAILED', async (t) => {
  injectDb(createMockSupabase({
    profiles: { data: [profileRow(ADMIN_ID, 'admin', 'ACTIVE', 'VERIFIED')], error: null },
    rpc: {
      review_traveller_kyc: { data: null, error: { code: '42501', message: 'insufficient_privilege' } },
    },
  }));
  const res = await rt.post(`/admin/profiles/${TRAVELLER_ID}/kyc-review`, { authorization: adminToken() }, {
    decision: 'VERIFIED',
    providerReference: 'kyc-provider-ref-004',
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'KYC_REVIEW_FAILED');
});
