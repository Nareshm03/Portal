import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTripToRequest } from '../src/services/matching.js';

const baseTrip = {
  origin_country: 'US',
  origin_airport_code: 'JFK',
  destination_country: 'IN',
  destination_airport_code: 'BLR',
  departure_at: '2026-12-10T12:00:00.000Z',
  arrival_at: '2026-12-11T06:00:00.000Z'
};

const baseRequest = {
  origin_country: 'US',
  origin_airport_code: 'JFK',
  destination_country: 'IN',
  destination_airport_code: 'BLR',
  needed_by: '2026-12-15T00:00:00.000Z'
};

test('1. Exact route and country match', () => {
  const result = matchesTripToRequest(baseTrip, baseRequest);
  assert.equal(result, true);
});

test('2. Different origin airport', () => {
  const trip = { ...baseTrip, origin_airport_code: 'EWR' };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('3. Different destination airport', () => {
  const trip = { ...baseTrip, destination_airport_code: 'BOM' };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('4. Different origin country', () => {
  const trip = { ...baseTrip, origin_country: 'CA' };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('5. Different destination country', () => {
  const trip = { ...baseTrip, destination_country: 'AE' };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('6. Departure after needed-by date', () => {
  const trip = {
    ...baseTrip,
    departure_at: '2026-12-16T00:00:00.000Z',
    arrival_at: '2026-12-17T00:00:00.000Z'
  };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('7. Arrival after needed-by date', () => {
  const trip = {
    ...baseTrip,
    departure_at: '2026-12-14T00:00:00.000Z',
    arrival_at: '2026-12-15T08:00:00.000Z'
  };
  const result = matchesTripToRequest(trip, baseRequest);
  assert.equal(result, false);
});

test('8. One matching trip among several', () => {
  const travellerTrips = [
    { ...baseTrip, origin_airport_code: 'LHR', origin_country: 'GB' }, // Different route
    { ...baseTrip, departure_at: '2026-12-16T00:00:00.000Z', arrival_at: '2026-12-17T00:00:00.000Z' }, // Late date
    baseTrip // Exact match
  ];

  const matched = travellerTrips.some((trip) => matchesTripToRequest(trip, baseRequest));
  assert.equal(matched, true);

  const candidateRequests = [
    baseRequest,
    { ...baseRequest, destination_airport_code: 'DEL' },
    { ...baseRequest, needed_by: '2026-12-08T00:00:00.000Z' }
  ];

  const matchedRequests = candidateRequests.filter((request) =>
    travellerTrips.some((trip) => matchesTripToRequest(trip, request))
  );

  assert.equal(matchedRequests.length, 1);
  assert.deepEqual(matchedRequests[0], baseRequest);
});

test('9. Null, undefined, and missing input objects', () => {
  assert.equal(matchesTripToRequest(null, baseRequest), false);
  assert.equal(matchesTripToRequest(baseTrip, null), false);
  assert.equal(matchesTripToRequest(null, null), false);
  assert.equal(matchesTripToRequest(undefined, undefined), false);
  assert.equal(matchesTripToRequest({}, baseRequest), false);
  assert.equal(matchesTripToRequest(baseTrip, {}), false);
  assert.equal(matchesTripToRequest({}, {}), false);
});