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

export const MILESTONES = Object.freeze({
  accepted: { key: 'accepted', label: 'Quote Accepted', requiresState: 'ACCEPTED' },
  locked: { key: 'locked', label: 'Payment Secured', requiresState: 'LOCKED' },
  purchased: { key: 'purchased', label: 'Item Purchased', requiresState: 'PURCHASED' },
  landed: { key: 'landed', label: 'Arrived - Awaiting Handover', requiresState: 'LANDED' },
  handover: { key: 'handover', label: 'Handover Verification', requiresState: 'COMPLETED' }
});

export const MILESTONE_ORDER = Object.freeze(['accepted', 'locked', 'purchased', 'landed', 'handover']);

export const STATE_MILESTONE_MAP = Object.freeze({
  ACCEPTED: 'accepted',
  LOCKED: 'locked',
  PURCHASED: 'purchased',
  LANDED: 'landed',
  COMPLETED: 'handover',
  DISPUTED: 'disputed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  FORFEITED: 'forfeited'
});

export const MILESTONE_DESCRIPTIONS = Object.freeze({
  accepted: 'Buyer accepted traveller\'s quote',
  locked: 'Upfront payment captured and order locked for fulfilment',
  purchased: 'Traveller confirmed item purchase',
  landed: 'Traveller confirmed arrival at destination',
  handover: 'Buyer confirmed receipt via OTP verification',
  disputed: 'Order disputed by a participant',
  expired: 'Order expired - payment deadline passed without payment',
  cancelled: 'Order cancelled by a participant',
  refunded: 'Order refunded after cancellation',
  forfeited: 'Order forfeited - handover deadline passed without buyer verification'
});

export function assertTransition(from, to) {
  if (!ORDER_STATES.includes(from) || !ORDER_STATES.includes(to)) throw new HttpError(400, 'UNKNOWN_ORDER_STATE', 'Unknown order state.');
  if (!TRANSITIONS[from].has(to)) throw new HttpError(409, 'INVALID_ORDER_TRANSITION', `Transition ${from} \u2192 ${to} is not allowed.`);
  return true;
}

export function buildTrackingInfo(order, events, paymentIntent) {
  const currentState = order.state;
  const currentMilestoneKey = STATE_MILESTONE_MAP[currentState] || currentState.toLowerCase();
  
  const completedMilestones = [];
  const pendingMilestones = [];
  let reachedCurrent = false;

  for (const key of MILESTONE_ORDER) {
    const milestone = MILESTONES[key];
    const event = events.find(e => e.to_state === milestone.requiresState);
    
    if (MILESTONE_ORDER.indexOf(key) < MILESTONE_ORDER.indexOf(currentMilestoneKey)) {
      completedMilestones.push({
        key: milestone.key,
        label: milestone.label,
        timestamp: event?.created_at ?? null,
        description: MILESTONE_DESCRIPTIONS[milestone.key]
      });
    } else if (key === currentMilestoneKey && currentState === milestone.requiresState) {
      completedMilestones.push({
        key: milestone.key,
        label: milestone.label,
        timestamp: event?.created_at ?? null,
        description: MILESTONE_DESCRIPTIONS[milestone.key]
      });
      reachedCurrent = true;
    } else {
      pendingMilestones.push({
        key: milestone.key,
        label: milestone.label,
        description: MILESTONE_DESCRIPTIONS[milestone.key]
      });
    }
  }

  if (!reachedCurrent && !['DISPUTED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'FORFEITED'].includes(currentState)) {
    pendingMilestones.unshift({
      key: currentMilestoneKey,
      label: MILESTONES[currentMilestoneKey]?.label ?? currentState,
      description: MILESTONE_DESCRIPTIONS[currentMilestoneKey] ?? ''
    });
  }

  let paymentState = 'NONE';
  if (paymentIntent) {
    const status = paymentIntent.status;
    if (['CREATING', 'CREATED', 'AUTHORIZED'].includes(status)) paymentState = 'PENDING';
    else if (status === 'CAPTURED') paymentState = 'CAPTURED';
    else if (status === 'FAILED') paymentState = 'FAILED';
    else if (status === 'REFUNDED') paymentState = 'REFUNDED';
  }

  const allTimestamps = [
    order.updated_at,
    ...events.map(e => e.created_at),
    paymentIntent?.updated_at
  ].filter(Boolean);

  const lastUpdated = allTimestamps.length > 0 
    ? new Date(Math.max(...allTimestamps.map(t => new Date(t).getTime()))).toISOString()
    : order.updated_at;

  return {
    current_milestone: currentState === 'DISPUTED' ? 'Disputed' :
                       currentState === 'EXPIRED' ? 'Expired' :
                       currentState === 'CANCELLED' ? 'Cancelled' :
                       currentState === 'REFUNDED' ? 'Refunded' :
                       currentState === 'FORFEITED' ? 'Forfeited' :
                       MILESTONES[currentMilestoneKey]?.label ?? currentState,
    completed_milestones: completedMilestones,
    pending_milestones: pendingMilestones,
    payment_state: paymentState,
    last_updated: lastUpdated
  };
}

export function buildPaymentSummary(paymentIntent) {
  if (!paymentIntent) {
    return {
      status: 'NONE',
      provider: null,
      amount_paise: 0,
      currency: 'INR',
      captured_at: null,
      provider_payment_id: null
    };
  }

  return {
    status: paymentIntent.status,
    provider: paymentIntent.provider,
    amount_paise: Number(paymentIntent.amount_paise),
    currency: paymentIntent.currency,
    captured_at: paymentIntent.status === 'CAPTURED' ? paymentIntent.updated_at : null,
    provider_payment_id: paymentIntent.provider_payment_id ?? null
  };
}
