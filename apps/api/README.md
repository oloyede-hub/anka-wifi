# Anka WiFi API

Single-business NestJS API using CommonJS and Prisma 7 with PostgreSQL.
Run commands from `apps/api`. The application and Prisma config load the shared
root `.env`; `DATABASE_URL` and `PAYSTACK_SECRET_KEY` are required; `FRONTEND_URL` configures the callback. See `.env.example`. Prices and purchase amounts serialize as
Decimal strings, such as `"100.25"`.

## Public API

- `GET /`: liveness only; does not check database readiness.
- `GET /packages`: active packages only.
- `GET /packages/:id`: active package, or 404.
- `POST /purchases`: `{ packageId, phone, email }`. Phone accepts 7–15 digits
  and an optional leading `+`; email is required and must be valid. Unknown fields
  (including amount, status, reference and accessCodeId) are rejected.
- `GET /purchases/:reference`: limited status/amount response. References are
  bearer secrets; avoid exposing them in logs or analytics. Customer contact
  details, payment data and access codes are never included.

Package writes, all access-code routes, and `GET /purchases` return 503 until
admin authentication/authorization replaces `AdminUnavailableGuard`. There is
no development bypass. Services remain usable internally for inventory setup.
Unconfigured Observe instrumentation with placeholder credentials was removed.

## Data rules

Purchase creation reads the authoritative package price, checks ACTIVE status
and AVAILABLE inventory, generates a reference with 128 random bits, and stores
a PENDING purchase and customer contact snapshot in one transaction. A customer
row represents checkout contact details; phone numbers are not verified identities
and are deliberately not used to merge customers.

The inventory check is advisory. Multiple pending purchases may observe the same
inventory. Creation does not reserve, assign, expose or sell a code. Payment initialization reserves inventory and creates a unique attempt atomically. Verification fulfills only a matching successful provider transaction. Reservation
expiry is independent of internet validity managed by the Wi-Fi system.

Access codes are exactly eight non-whitespace characters, case-sensitive and
unique across packages. Bulk creation accepts one package ID and up to 1,000
codes, skips duplicates using the database unique constraint, and reports
`requested`, `created`, `skipped`, `duplicatesInRequest` and `alreadyStored`.
Only AVAILABLE codes with no reservation/sale/purchase metadata can be edited;
this condition is checked atomically in the write. Normal creation accepts no
state or timestamp controls. Package prices must be positive, fit Decimal(10,2),
and have at most two decimal places. PATCH omissions are accepted; null is rejected.

## Verification

```powershell
pnpm exec prisma validate --config prisma7.config.ts
pnpm exec prisma generate --config prisma7.config.ts
pnpm build
pnpm test
pnpm test:e2e
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec oxlint src/ test/
```

HTTP tests use compiled Nest classes for production decorator metadata and mock
Prisma, so build before running them. They do not require or modify a database.
The existing `pnpm lint` type-aware checker rejects `moduleResolution: "node"`;
standard Oxlint and the installed TypeScript compiler work with this CommonJS
configuration. Build/module settings and dependency versions were preserved.

No migration is required by this review. The existing schema already has unique
codes/references, Decimal amounts, foreign keys, states and inventory indexes.
Before exposing checkout in production, add request throttling at the ingress or
API. Before re-enabling admin endpoints, implement admin authorization. The next feature is signature-verified Paystack webhooks reusing idempotent fulfillment, with failure and recovery handling.

## Payment review (2026-10-04)

`POST /payments/initialize` accepts only `{ purchaseReference }` and returns
`purchaseReference`, `paymentReference`, and `authorizationUrl`. The backend checks
PENDING purchase status, ACTIVE package status, and valid customer email. Payment
amount comes from the stored purchase; Decimal multiplication produces exact
integer kobo. Every initialization uses a new 128-bit random PAY reference.

Purchase row locks serialize initialization/reservation/fulfillment for a purchase.
Reservation and payment creation share one transaction; conditional AVAILABLE
claims retry at most three times if another customer wins inventory. Network
calls run after commit with a 15-second timeout and runtime response validation.
Only one unresolved attempt may exist for a purchase. A timeout or malformed/API
response retains its attempt and reservation because Paystack may have accepted
it; the error includes the payment reference for verification. Blindly restarting
checkout would risk duplicate charges.

`GET /payments/verify/:reference` checks Paystack status, exact amount, NGN currency,
reference, and stored purchase amount before fulfillment. It rereads after locking
and atomically changes Payment to SUCCESSFUL, Purchase to COMPLETED, and the
purchase's matching RESERVED code to SOLD, with timestamps. Repeated and concurrent
verification return the same result. Code-bearing responses use `Cache-Control:
no-store`; payment references are bearer secrets, so keep them out of public logs.
No webhook endpoint was added.

Expired reservations can be released/replaced during initialization only when no
PENDING or SUCCESSFUL payment remains. An unresolved reservation is deliberately
not recycled solely because its timer elapsed; verified late success may fulfill
it if the code still belongs to that purchase. Automated release, unsuccessful
payment-state transitions, unknown-provider reconciliation and recovery are still
required with the next webhook feature. Additional money received for an already
completed purchase must be reconciled rather than selling another code.

The existing `support_payment_attempts` migration already enables one purchase to
many payments. No schema change or new migration was needed in this review; the
application database migration status was checked and is current. Application
data was not changed by the live tests.

Live concurrency/rollback coverage uses a random temporary schema populated by
existing migration SQL, then removes only that schema. To opt in after building:

```powershell
$env:RUN_PAYMENT_DB_TESTS = '1'
pnpm test:e2e
Remove-Item Env:RUN_PAYMENT_DB_TESTS
```

Without that flag the four database tests are skipped and the HTTP tests use mocks.
The configured database role needs CREATE SCHEMA privileges for the opt-in tests.
Paystack itself is mocked in all tests; no charge or real provider request is made.
Provider requirements were checked against the [transaction API](https://paystack.com/docs/api/transaction/)
and [verification documentation](https://paystack.com/docs/payments/verify-payments/).
