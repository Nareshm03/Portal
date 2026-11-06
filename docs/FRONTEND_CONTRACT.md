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
  "note": "Retail receipt will be provided"
}
```

The backend sets FX rate/source/time and quote expiry. The current flow leaves duty unset; quote acceptance is blocked until a compliance reviewer records the duty amount and assessment reference.

### Accept quote

`POST /quotes/:id/accept`

```json
{}
```

Response includes order ID, integer price breakdown and the initial payment deadline.

### Create payment intent

`POST /payments/create-order`

Headers: `Idempotency-Key: order-<uuid>-deposit-v1`

```json
{ "orderId": "00000000-0000-4000-8000-000000000002" }
```

Mock response includes `mock: true` and explicitly states that no money is collected.

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
ACCEPTED --captured deposit--> LOCKED --> PURCHASED --> LANDED --> COMPLETED
    |                            |            |           |
    +-- 15m unpaid --> EXPIRED   +-- dispute -+-- dispute +-- dispute
                                                            |
                                          72h unconfirmed <--+--> FORFEITED
```

Allowed transitions are revalidated in PostgreSQL. `EXPIRED`, `COMPLETED` and `FORFEITED` are terminal. `DISPUTED` is a hold state with no self-service exit. Admin dispute resolution is not part of this starter.

## Error shape

```json
{ "error": { "code": "COMPLIANCE_REVIEW_REQUIRED", "message": "...", "requestId": "..." } }
```
