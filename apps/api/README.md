# Anka WiFi API

Single-business NestJS 12 API, CommonJS, Prisma 7.10 and PostgreSQL. Customers have
no accounts; administrators authenticate. Application and Prisma configuration
continue to load the monorepo root `.env`. See `.env.example` for placeholders.
Never prefix server secrets with `NEXT_PUBLIC_` or copy them into frontend config.

## Setup and first administrator

Configure `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `FRONTEND_URL`, and a random
`ADMIN_JWT_SECRET` of at least 32 bytes in the root `.env`. Placeholder/weak JWT
secrets fail startup. `ADMIN_JWT_EXPIRES_IN` defaults to `1h`; supported values are
integer seconds or `s`/`m`/`h` suffixes, between 5 minutes and 24 hours. Generate a
secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and keep it private. `PAYSTACK_PUBLIC_KEY` and `API_URL` are documented for client
integration; neither replaces server authentication.

Run the explicit bootstrap command from `apps/api`. It creates a new admin with a
normalized email and salted bcryptjs password hash, never overwrites existing users,
and does not require the API to be running. No public registration endpoint exists.
Do not persist the bootstrap password in `.env`, shell history, or source control.

```powershell
pnpm build
$env:ANKA_BOOTSTRAP_EMAIL = 'admin@anka-wifi.com'
$env:ANKA_BOOTSTRAP_NAME = 'Administrator'
$bootstrapPassword = Read-Host 'Admin password (at least 12 characters, at most 72 UTF-8 bytes)' -AsSecureString
$env:ANKA_BOOTSTRAP_PASSWORD = [Net.NetworkCredential]::new('', $bootstrapPassword).Password
try {
  pnpm admin:bootstrap
} finally {
  Remove-Item Env:ANKA_BOOTSTRAP_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:ANKA_BOOTSTRAP_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:ANKA_BOOTSTRAP_NAME -ErrorAction SilentlyContinue
  $bootstrapPassword = $null
}
```

`POST /admin/auth/login` accepts `{ email, password }` and returns `accessToken`,
`tokenType`, `expiresIn`, and the admin's ID/name/email. Password hashes are never
returned. Email is trimmed and lowercased; invalid credentials use one generic
401 response and unknown accounts still incur password-derivation work. Existing
admins must have normalized emails and hashes produced by this bootstrap script.
Bcryptjs uses cost 12 and a fresh random salt for each password. Passwords over
72 UTF-8 bytes are rejected to prevent [bcryptjs truncation](https://github.com/dcodeIO/bcrypt.js#security-considerations).
Passwords are hashed, never reversibly encrypted. Previous scrypt hashes are no
longer accepted; existing administrators need a controlled password reset to a
bcrypt hash before login. Hashes cannot be converted without the original password.
The bootstrap command continues to create new accounts only and never replaces
existing accounts or passwords.

`GET /admin/auth/me` validates an admin Bearer token and returns only the current
admin's ID, name and email, with no-store caching. The frontend uses this endpoint
to validate its HttpOnly-cookie session before rendering protected admin pages.

Send `Authorization: Bearer <accessToken>` on management requests. JWT verification
requires HS256, issuer `anka-wifi`, audience `anka-admin`, subject and expiry. Every
protected request checks that the subject still identifies an admin and attaches
that identity to `request.admin`. No customer tokens, roles or refresh-token system
were added. Tokens remain valid until expiry after a password change; deleting
an admin or rotating the signing secret invalidates access.

## Routes

Public routes remain:

- `GET /`: liveness, not database readiness.
- `GET /packages` and `GET /packages/:id`: ACTIVE packages only.
- `POST /purchases`: `{ packageId, phone, email }`; phone is 7�15 digits with an
  optional leading `+`, email is required, and unknown fields are rejected.
- `GET /purchases/:reference`: limited status/amount projection, no contacts/code.
- `POST /payments/initialize`: `{ purchaseReference }`; server-derived amount only.
- `GET /payments/verify/:reference`: authoritative verification and code delivery
  only after completed fulfillment. References are bearer secrets; keep them out
  of public logs, analytics, and shared browser history.
- `POST /payments/webhook`: Paystack HMAC authentication, no admin JWT required.

Admin routes require an admin JWT. Missing or invalid credentials return 401.

| Route                 | Operations                                                                              |
| --------------------- | --------------------------------------------------------------------------------------- |
| `/admin/packages`     | GET all statuses; POST create; PATCH `/:id` update, including ACTIVE/INACTIVE status    |
| `/admin/access-codes` | GET list, POST create, POST `/bulk`, GET/PATCH `/:id`, POST `/:id/disable`              |
| `/admin/purchases`    | GET list and GET `/:reference` with customer/package/code and payment-attempt summaries |
| `/admin/payments`     | GET list and GET `/:reference` with payment status and purchase relationship            |

Existing `POST /packages`, `PATCH /packages/:id`, all `/access-codes` routes, and
`GET /purchases` are also admin-protected for compatibility. No admin endpoint
allows arbitrary purchase/payment state or reservation/sale timestamp updates.

Management lists return arrays with `limit` (default 50, maximum 100) and `offset`
(default 0, maximum 100000). Filters: packages `status`; codes `packageId`/`status`;
purchases `status`/`reference`/`customerId`/`phone`; payments `status`/`purchaseReference`.
Unknown filters and invalid enum/pagination values are rejected. Contact data and
inventory codes appear only in authenticated management responses.

Access codes are eight non-whitespace characters and globally unique. Bulk upload
chooses one package, accepts up to 1000 codes, skips database/request duplicates,
and returns `requested`, `created`, `skipped`, `duplicatesInRequest`, `alreadyStored`.
Edits/disabling require an unused AVAILABLE code with no purchase, reservation or
sale metadata; the condition is enforced in the write. Disable cannot change a
RESERVED/SOLD code. Package prices must fit Decimal(10,2), be positive and have at
most two decimals. PATCH omissions are accepted; null and unknown fields rejected.
Money remains Decimal in storage and serializes as strings.

## Payments and webhook guarantees

Purchase creation stores contact details and the PENDING purchase atomically,
using the package's database price. Its inventory check is advisory. Initialization
locks the purchase, checks status/package/email, reserves inventory and creates a
new unique payment attempt in one transaction. Conditional AVAILABLE claims retry
at most three times. Only one unresolved attempt may exist per purchase. Every new
Paystack initialization gets a new reference; no reference is reused.

Paystack calls occur outside transactions, use HTTPS, a 15-second timeout and
runtime response validation. Decimal multiplication converts NGN to integer kobo
without floating-point rounding. Timeouts retain the PENDING attempt and reservation
because the provider may already have accepted the request. Error responses include
the attempt reference for manual recovery, but never upstream secrets/details.

Nest preserves raw request bytes. The webhook verifies a strict 128-hex-character
HMAC-SHA512 signature using the Paystack secret and timing-safe binary comparison,
then parses and validates only the authenticated bytes. Unsupported events and
unknown/non-Paystack payments are acknowledged with `{ received: true }` and no
fulfillment. Relevant `charge.success` deliveries reuse manual verification and
its existing reference/amount/NGN/purchase checks. Processing failures return a
generic 503 for Paystack retry; invalid signatures return 401 and invalid signed
payloads return 400. No code, contact or payment details appear in webhook responses.

Fulfillment locks and rereads the purchase, then atomically marks Payment SUCCESSFUL,
Purchase COMPLETED, and that purchase's matching RESERVED code SOLD. It records
paidAt/completedAt/soldAt and clears reservation timestamps. Duplicate webhook,
webhook+manual, and manual+manual requests return/acknowledge existing fulfillment
without reselling or overwriting timestamps. A still-held expired reservation may
fulfill a verified late success; unresolved reservations are not recycled solely
because their timer elapsed. Reservation expiry is unrelated to hotspot validity.

Configure Paystack's webhook URL as `<API_URL>/payments/webhook`. No deployment was
performed. See [Paystack webhook documentation](https://paystack.com/docs/payments/webhooks/).

## Throttling and remaining work

`@nestjs/throttler` limits login to 5 requests/minute, initialization to 10/minute,
and manual verification to 30/minute, by client IP and route. Webhooks have no
throttler guard. Limits are in-memory per API process and reset on restart; they
are not a shared multi-instance limit. Express proxy trust was not enabled: set an
explicit trusted-proxy configuration at deployment if the API sits behind a proxy;
never blindly trust client-supplied forwarded headers. Distributed brute-force and
volumetric protection still belong at the ingress.

Next payment work is bounded recovery/reconciliation for failed/uncertain attempts
and abandoned reservations, with operational alerts. Additional charges for an
already completed purchase require reconciliation rather than another code sale.
No refunds, queues, cron jobs, customer authentication or frontend work was added.
The new admin module uses the existing Admin table. No Prisma schema change or new
migration is required. No real admin or password was created during this pass.

## Verification

```powershell
pnpm exec prisma validate --config prisma7.config.ts
pnpm build
pnpm exec tsc --noEmit -p tsconfig.json
pnpm exec oxlint --deny-warnings src/ test/
pnpm test
pnpm test:e2e
# Opt in to live, isolated PostgreSQL concurrency/rollback tests:
$env:RUN_PAYMENT_DB_TESTS = '1'
try { pnpm test:e2e } finally { Remove-Item Env:RUN_PAYMENT_DB_TESTS }
```

### Payment recovery and alert operations

An external scheduler can call `POST /admin/payments/reconcile` with an admin
Bearer token and JSON `{ "limit": 5 }`. Only Paystack PENDING attempts older than
15 minutes are selected. The limit is 1–5, with sequential provider calls and
the existing 15-second timeout per call. Allow at least 90 seconds at the ingress.
The endpoint permits one request per minute per process/client and rejects a
second overlapping batch in the same process. Use one scheduler across replicas;
database purchase locks protect state changes across replicas, though duplicate
provider verification calls can still occur.

Pass the response's `nextAfterId` as `afterId` on the next scheduled invocation
until it is null, then start a fresh sweep without a cursor. Persist this cursor
in the scheduler so unresolved early records do not starve later records. A
cursor is an internal payment ID, never a public payment reference. No automatic
worker starts on API boot, no new dependencies or migration are required, and
no live provider reconciliation is performed by the test suite.

Confirmed success uses the same locked fulfillment as webhooks. A validated
provider `failed` response atomically marks the payment FAILED, detaches its
reservation and returns inventory to AVAILABLE, leaving the purchase PENDING
for a new attempt. Other unresolved attempts prevent release. Timeouts, missing
provider transactions, mismatches, abandoned/ongoing/pending/processing/queued,
reversed and unknown statuses retain inventory. Reservation expiry alone never
releases a payment-backed reservation. See
[Paystack transaction statuses](https://paystack.com/docs/payments/verify-payments/).

Route structured log events into your deployment log monitor:
`payment_reconciliation_attention` (warning, internal payment ID and generic
reason), `payment_late_success_requires_review` (error), and
`payment_reconciliation_batch` (completion count). Alert on attention/error
events and on missing scheduled completion events. Logs omit customer data,
WiFi codes, bearer payment references, provider payloads and exception text.
The authenticated batch response also contains per-payment outcomes. Alerts are
log events; no email, Slack delivery, persistent alert inbox or deduplication is
configured. Repeated unresolved attempts emit repeated warnings. A late success
notification on an already FAILED attempt raises an error and returns retryable
503 for operator review, rather than silently acknowledging lost fulfillment.
Never manually release uncertain payments solely because they are old.

HTTP tests use compiled Nest classes for production decorator metadata; build first.
Paystack and OPay HTTP are mocked in tests, so no real transaction is initialized or charged.
Live tests create a random temporary schema using existing migration SQL and remove
only that schema, preserving application data. The database role needs CREATE SCHEMA
privileges. Without the flag the thirteen live tests are skipped. Unit setup loads
reflect-metadata explicitly. The existing type-aware `pnpm lint` checker rejects
`moduleResolution: "node"`; standard Oxlint and TypeScript checks pass with the
unchanged CommonJS configuration. No dependency upgrade was needed; JWT/throttler
were added and mapped-types was removed as requested.

## OPay Checkout

OPay is available alongside Paystack. See [OPAY.md](./OPAY.md) for the implementation report, credentials, official specifications, Windows sandbox scenarios and validation commands.

## Admin reporting

`GET /admin/reports/overview` requires the existing admin bearer authentication and returns a repeatable-read database snapshot with all-time purchase/payment/code/package status counts, completed-purchase revenue, average package price, payment-status distribution and completed sales by package name. Money remains decimal strings.

Sales series use `completedAt`; payment-volume series use successful NGN payments by `paidAt`. Failed/pending/refunded attempts do not contribute to volume. Windows include the current Africa/Lagos day/week/month and cover 30 days, 12 Monday-based weeks and 12 months. Empty buckets are zero-filled. The frontend refreshes the uncached response every minute and after inventory/package mutations. No database migration is required.
