import { HttpError } from '../utils/httpError.js';

const BLOCKED_CATEGORIES = new Set(['firearms', 'ammunition', 'narcotics', 'wildlife_products', 'counterfeit_goods', 'explosives', 'radioactive_materials']);

/**
 * This is a release gate, not a legal opinion or a customs-duty calculator.
 * Third-party carriage through passenger baggage always needs a human compliance decision.
 */
export function evaluateRequest({ productCategory, isForThirdParty = true, fulfilmentMode = 'PASSENGER_BAGGAGE', hsCode = null }) {
  const category = String(productCategory ?? '').trim().toLowerCase();
  if (BLOCKED_CATEGORIES.has(category)) {
    return { status: 'REJECTED', canMatch: false, reasons: ['This category is blocked by the platform safety policy.'], reviewedBy: null };
  }
  if (fulfilmentMode === 'PASSENGER_BAGGAGE' && isForThirdParty) {
    return {
      status: 'REVIEW_REQUIRED', canMatch: false,
      reasons: [
        'Goods carried for another person may constitute a commercial-purpose import rather than bona fide personal baggage.',
        'A customs/compliance reviewer must confirm a lawful import route before matching or payment.'
      ], reviewedBy: null
    };
  }
  if (!hsCode) {
    return { status: 'REVIEW_REQUIRED', canMatch: false, reasons: ['A validated HS classification and import-route review are required.'], reviewedBy: null };
  }
  return { status: 'REVIEW_REQUIRED', canMatch: false, reasons: ['Manual compliance approval is required before this request can be matched.'], reviewedBy: null };
}

export function assertRequestMatchable(request) {
  if (request?.compliance_status !== 'APPROVED') {
    throw new HttpError(409, 'COMPLIANCE_REVIEW_REQUIRED', 'This request cannot be matched until a compliance reviewer approves the import route.');
  }
  return true;
}
