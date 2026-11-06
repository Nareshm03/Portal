import { HttpError } from '../utils/httpError.js';

export const ORDER_STATES = Object.freeze(['ACCEPTED', 'LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED', 'FORFEITED', 'DISPUTED', 'EXPIRED', 'CANCELLED', 'REFUNDED']);
export const TRANSITIONS = Object.freeze({
  ACCEPTED: new Set(['LOCKED', 'EXPIRED', 'CANCELLED']),
  LOCKED: new Set(['PURCHASED', 'DISPUTED', 'CANCELLED', 'REFUNDED']),
  PURCHASED: new Set(['LANDED', 'DISPUTED', 'CANCELLED']),
  LANDED: new Set(['COMPLETED', 'DISPUTED', 'FORFEITED']),
  CANCELLED: new Set(['REFUNDED']),
  DISPUTED: new Set(),
  COMPLETED: new Set(), FORFEITED: new Set(), EXPIRED: new Set(), REFUNDED: new Set()
});

export function assertTransition(from, to) {
  if (!ORDER_STATES.includes(from) || !ORDER_STATES.includes(to)) throw new HttpError(400, 'UNKNOWN_ORDER_STATE', 'Unknown order state.');
  if (!TRANSITIONS[from].has(to)) throw new HttpError(409, 'INVALID_ORDER_TRANSITION', `Transition ${from} → ${to} is not allowed.`);
  return true;
}
