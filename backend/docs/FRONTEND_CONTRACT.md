# Portal API Contract — Frontend Handoff

Base URL: `http://localhost:4000/api/v1` (development)

Authentication: `Authorization: Bearer <Supabase access_token>` for protected routes.

Content-Type: `application/json` for JSON writes.

Payment idempotency: send a fresh stable `Idempotency-Key` header per payment attempt; reuse that exact value for retry of the same attempt.

All money fields ending in `Paise` are integer INR paise. Foreign item prices are integer minor units in the listed currency. Never send JavaScript floats as money.

## Key request shapes

### Create request

```json
{
  "originCountry": "US",
  "originAirportCode": "JFK",
  "destinationCountry": "IN",
  "destinationAirportCode": "BLR",
  "neededBy": "2026-12-15T00:00:00.000Z",
  "productTitle": "Example phone",
  "productCategory": "electronics",
  "productUrl": "https://example.com/item",
  "quantity": 1,
  "declaredValueMinor": 79900,
  "declaredCurrency": "USD",
  "hsCode": "85171300",
  "fulfilmentMode": "PASSENGER_BAGGAGE",
  "isForThirdParty": true
}
```

Expected initial compliance response: `REVIEW_REQUIRED`, `canMatch: false`. Do not show this request to travellers until it is approved.

### Create trip

```json
{
  "originCountry": "US",
  "originAirportCode": "JFK",
  "destinationCountry": "IN",
  "destinationAirportCode": "BLR",
  "departureAt": "2026-12-10T13:00:00.000Z",
  "arrivalAt": "2026-12-11T07:00:00.000Z",
  "capacityKg": 3.5
}
```

Trips are created in `DRAFT`; verified KYC and an admin activation are required before matching.

### Create quote

```json
{
  "tripId": "00000000-0000-4000-8000-000000000001",
  "itemPriceMinor": 79900,
  "itemCurrency": "USD",
  "travellerRewardPaise": 8000,
  "note": "Retail receipt will be provided"
}
```

`travellerRewardPaise` is a separate INR reward the traveller enters for the haul; it is frozen verbatim on acceptance (no reward formula is computed). The backend sets FX rate/source/time and quote expiry. The current flow leaves duty unset; quote acceptance is blocked until a compliance reviewer records the duty amount and assessment reference.

### Accept quote

`POST /quotes/:id/accept`

```json
{}
```

Response includes order ID, integer price breakdown and the initial payment deadline. The breakdown follows the approved rules — platform fee and commitment deposit are computed on the product cost only (excluding duty):

- `subtotalPaise` = product cost + duty + traveller reward
- `platformFeePaise` = 5% of product cost
- `totalPaise` = subtotal + platform fee
- `depositPaise` = 25% of product cost (commitment deposit)
- `upfrontPaise` = deposit + duty + platform fee (collected at lock)
- `balancePaise` = total − upfront (settled on completion)

### Create payment intent

`POST /payments/create-order`

Headers: `Idempotency-Key: order-<uuid>-upfront-v1`

```json
{ "orderId": "00000000-0000-4000-8000-000000000002" }
```

The intent captures the order's **upfront collection** (`deposit + duty + platform fee`), not just the deposit. Mock response includes `mock: true` and explicitly states that no money is collected.

### Verify mock payment

`POST /payments/verify`

```json
{
  "paymentIntentId": "00000000-0000-4000-8000-000000000003",
  "providerOrderId": "mock_00000000-0000-4000-8000-000000000003"
}
```

Only works outside production while `MOCK_PAYMENTS=true`.

## Order lifecycle

```text
ACCEPTED --captured upfront--> LOCKED --> PURCHASED --> LANDED --OTP verify--> COMPLETED
    |                            |            |           |
    +-- 15m unpaid --> EXPIRED   +-- dispute -+-- dispute +-- dispute
                                                            |
                                          72h unconfirmed <--+--> FORFEITED
```

Allowed transitions are revalidated in PostgreSQL. `EXPIRED`, `COMPLETED` and `FORFEITED` are terminal. `DISPUTED` is a hold state with no self-service exit. Admin dispute resolution is not part of this starter.

## Handover (OTP-gated completion)

Completion is gated by a one-time OTP issued to the buyer. There is no direct `/orders/:id/handover` endpoint.

`POST /orders/:id/handover/issue-otp` — buyer or traveller, only when the order is `LANDED`. Generates a fresh 6-digit code (any prior unconsumed code for the order is invalidated). In demo mode the response includes `code` and `demo: true` so it can be surfaced for testing; in production the code is delivered to the buyer out-of-band and never returned by the API.

`POST /orders/:id/handover/verify` — buyer only, body `{ "code": "123456" }`. Verifies the code, marks the challenge consumed, transitions the order to `COMPLETED`, and posts the settlement ledger. On an incorrect code the attempt counter increments; after repeated failures request a new code.

## Error shape

```json
{ "error": { "code": "COMPLIANCE_REVIEW_REQUIRED", "message": "...", "requestId": "..." } }
```
