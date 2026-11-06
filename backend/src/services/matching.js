/**
 * Pure matching predicate connecting a traveller trip to a buyer request based on route, country, and timing.
 *
 * @param {Object} trip - The traveller's trip record.
 * @param {Object} request - The buyer's request record.
 * @returns {boolean} True if the trip route, countries, and timings satisfy the request.
 */
export function matchesTripToRequest(trip, request) {
  if (!trip || !request) return false;
  if (!trip.origin_airport_code || !request.origin_airport_code) return false;
  if (!trip.destination_airport_code || !request.destination_airport_code) return false;
  if (!trip.origin_country || !request.origin_country) return false;
  if (!trip.destination_country || !request.destination_country) return false;
  if (!trip.departure_at || !trip.arrival_at || !request.needed_by) return false;

  const departure = new Date(trip.departure_at);
  const arrival = new Date(trip.arrival_at);
  const neededBy = new Date(request.needed_by);

  if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime()) || Number.isNaN(neededBy.getTime())) {
    return false;
  }

  return (
    trip.origin_airport_code === request.origin_airport_code &&
    trip.destination_airport_code === request.destination_airport_code &&
    trip.origin_country === request.origin_country &&
    trip.destination_country === request.destination_country &&
    departure <= neededBy &&
    arrival <= neededBy
  );
}