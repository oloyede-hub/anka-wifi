# OPay integration and Windows sandbox checks

Reviewed against the official Nigeria OPay Checkout documentation on 2026-10-05. Paystack remains available and is the default for clients that omit `provider`.

## Implementation report

| # | Requested item | Result |
| --- | --- | --- |
| 1 | Documentation | [Getting Started](https://documentation.opaycheckout.com/getting-started), [Express Checkout](https://documentation.opaycheckout.com/checkout-overview), [Authentication](https://documentation.opaycheckout.com/payment-authentication), [Create](https://documentation.opaycheckout.com/cashier-create), [Status](https://documentation.opaycheckout.com/query-payment-status), [API signature](https://documentation.opaycheckout.com/api-signature), [Callbacks](https://documentation.opaycheckout.com/payment-notifications-callbacks), [Callback signature](https://documentation.opaycheckout.com/callback-signature), [Regional methods](https://documentation.opaycheckout.com/regional-payment-methods), [Testing](https://documentation.opaycheckout.com/end-to-end-testing). |
| 2 | Provider endpoints | POST `/api/v1/international/cashier/create` and POST `/api/v1/international/cashier/status`, under configured official test/live origin. |
| 3 | Request authentication | Create: `Authorization: Bearer <public key>`. Status: `Authorization: Bearer <HMAC-SHA512 signature>` over alphabetically ordered JSON transmitted unchanged. Both send `MerchantId`. |
| 4 | Callback authentication | JSON `sha512` is HMAC-SHA3-512 using the private key and the exact canonical string below, compared using constant-time binary comparison. No Paystack header is reused. |
| 5 | Environment | API example adds `OPAY_MERCHANT_ID`, `OPAY_PUBLIC_KEY`, `OPAY_PRIVATE_KEY`, `OPAY_BASE_URL`. Existing `API_URL` must be public HTTPS for OPay callbacks. Web example adds server-only `API_URL` for runtime proxy configuration, retaining `NEXT_PUBLIC_API_URL` fallback. |
| 6 | Prisma | Only `PaymentProvider.OPAY`; existing generic Payment and multiple attempts per Purchase remain. |
| 7 | Migration | Reused the already present `20261005163004_add_opay_payment_provider` enum migration. Client regenerated with Prisma 7.10. Migration deploy reports no pending migrations. |
| 8 | New implementation files | `src/payments/opay/opay.service.ts`, `opay.types.ts`, `opay.service.spec.ts`, `src/payments/verified-transaction.ts`, this guide. The two adapter files were empty scaffolds at the start. |
| 9 | Modified files | Payment service/controller/module/initialization DTO/unit tests; purchase admin projection; API/web env examples; all three existing HTTP/PostgreSQL test files; web customer API, query function input, checkout, callback/recovery, provider copy, admin payment/purchase details and schemas; web server proxies/session API destination; three existing smoke scripts. Prisma enum/client/migration and AdminShell changes already existed and were preserved. |
| 10 | Initialization | Lock Purchase, reject competing unresolved attempts across providers, reserve one code, create OPAY attempt from stored Decimal amount, commit, then call provider. Normalize cashier URL and persist actual order number in a short separate locked transaction. |
| 11 | Mobile | Send documented `customerVisitSource: "BROWSER"` and `evokeOpay: true`. Cashier retains available desktop methods. App invocation depends on OPay, browser/device and installed app; it is not guaranteed. |
| 12 | Callback | POST `/payments/opay/webhook`: parse authenticated canonical fields from raw JSON, verify signature, locate OPAY attempt, then independently query. Unsupported/authenticated notifications and unknown/wrong-provider references acknowledge 200; transient processing failure returns 503 so OPay can retry. |
| 13 | Query | GET Anka `/payments/verify/:reference` selects provider from stored Payment, never browser parameters. OPay status is queried by merchant reference, including when create response/order number was lost. Runtime validation rejects malformed responses. |
| 14 | Shared fulfillment | Both providers produce `VerifiedTransaction`; the same validation, Purchase row lock and atomic Payment/Purchase/AccessCode writes deliver the reserved code. |
| 15 | OPay provider reference | Store returned/query-verified `orderNo`; match stored order when available. Callback `transactionId` is signed but is not assumed to equal `orderNo`. |
| 16 | Paystack provider reference | The old implementation stored merchant `reference`. New successful/reconciled attempts store `String(data.id)`, matching the provider identifier in [Paystack's transaction API](https://paystack.com/docs/api/transaction/). Legacy completed records are not rewritten; legacy merchant references on pending records remain compatible. Database uniqueness errors roll back the whole fulfillment. |
| 17 | Checkout | Accessible Paystack/OPay radio choices; normalized response validation; HTTPS redirect checks; unresolved attempt disables provider switching/reinitialization and exposes its private recovery reference. |
| 18 | Browser return | Same callback/check pages independently verify. Trusted backend pending/failed states are displayed without a code. Success shows the provider from backend data, not URL hints. Cancel uses the same verification flow. |
| 19 | Admin | OPAY schema support, provider badges, provider references and currency in details, references in payment list/mobile cards, multiple attempts retained. No manual success action. |
| 20 | Unit/HTTP tests | Provider HTTP is mocked. Official callback signature vector, response/config/URL validation, safe errors, trusted amount, order persistence, unknown initialization, mismatches, callback authenticity, pending/failure and duplicate processing; existing Paystack tests retained. |
| 21 | Database tests | Existing live isolated PostgreSQL suite extended with mixed initialization race, OPay callback/browser/duplicate race, OPay FAIL followed by new Paystack attempt, lost create response, and forced OPay write rollback/retry. |
| 22 | Idempotency | Lock same Purchase, reread current Payment, validate state/order/amount, conditional code claim, and return checked completed state on repeated processing. |
| 23 | Unknown outcomes | Keep PENDING and reservation on timeout, provider error, malformed response or mismatch. Reconciliation examines both providers, at most five attempts aged 15 minutes or more; only independently verified failure releases inventory. CLOSE remains unresolved. Late success on a locally FAILED attempt alerts and returns retryable failure for review. |
| 24 | Types | API `tsc --noEmit --incremental false` and frontend typecheck passed; both builds include type validation. |
| 25 | Lint | Frontend ESLint and standard API Oxlint passed. Existing API `pnpm lint` type-aware checker rejects its pre-existing `moduleResolution: "node"` (node10); preserved CommonJS settings. |
| 26 | API build | `pnpm build` passed. |
| 27 | Web build | Final `pnpm build` passed, including production TypeScript validation. |
| 28 | Limits | No real merchant sandbox transaction performed. Deployment needs reachable HTTPS callback and correct merchant keys. Existing per-process throttling/reconciliation guard and operator-triggered recovery remain; no distributed infrastructure introduced. Existing Paystack validation safely rejects IDs beyond JavaScript's safe integer range; this change does not replace its JSON parser with a 64-bit parser. |
| 29 | Assumptions/discrepancies | Follow endpoint-specific authentication and code examples where overview summaries conflict; accept documented sample success code `00000`, not unrelated prose `00`. Callback sample uses boolean `refunded` despite table saying String. Request/query amount is integer cent/minor unit (NGN kobo); callback table's vague units are never used to establish money. Some Nigeria pages have Egypt HTML titles. No documented paid timestamp in status response: OPay paidAt records local verified fulfillment time, not order createTime. |
| 30 | Manual sandbox | Exact steps below. |

The callback canonical string is case-sensitive and intentionally not JSON serialization:

```text
{Amount:"<amount>",Currency:"<currency>",Reference:"<reference>",Refunded:<t or f>,Status:"<status>",Timestamp:"<timestamp>",Token:"<token or empty>",TransactionID:"<transactionId>"}
```

The [official callback signature example](https://documentation.opaycheckout.com/callback-signature) is an automated test vector. Query authentication uses SHA-512; callback authentication uses SHA3-512.

## Configure development

### Local callback tunnel helper

`pnpm --filter api opay:tunnel` starts a development-only HTTPS callback tunnel using the checksum-verified portable `cloudflared.exe` in `%TEMP%\anka-opay-tunnel`. It updates root `API_URL` and prints the new callback URL. Keep the helper running and restart the API after a new URL is generated. The gateway exposes only `POST /payments/opay/webhook` and a health probe; every other public path returns 404. Frontend `.env.local` should retain `API_URL=http://localhost:4000`. Cloudflare Quick Tunnel hostnames are temporary and change between launches; use a stable production callback origin when deploying. See [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

The portable binary is downloaded from the official `cloudflare/cloudflared` GitHub release, verified against its published SHA-256, and kept outside the repository. This helper does not install a Windows service or contact the payment provider.

1. Open the OPay merchant dashboard, select test/staging credentials under **API Keys & Webhooks**, and obtain merchant ID, public key and private key. Follow [Getting Started](https://documentation.opaycheckout.com/getting-started). Store actual credentials only in `C:\Users\HomePC\Desktop\anka-wifi\.env`; do not put keys in any `NEXT_PUBLIC_*` variable.
2. Expose port 4000 using your chosen HTTPS development tunnel/reverse proxy. Keep it active for provider callbacks. Set these root `.env` values, retaining existing DATABASE_URL, Paystack and admin settings:

```dotenv
OPAY_MERCHANT_ID=<your test merchant ID>
OPAY_PUBLIC_KEY=<your test public key>
OPAY_PRIVATE_KEY=<your test private key>
OPAY_BASE_URL=https://testapi.opaycheckout.com
API_URL=https://<your-api-tunnel-host>
FRONTEND_URL=http://localhost:3000
```

For testing on a physical phone, expose frontend port 3000 too and set FRONTEND_URL to its public HTTPS origin. `localhost` refers to the phone on a physical device.

3. In `apps/web/.env.local`, set server-only `API_URL=http://localhost:4000`. This is the frontend proxy destination, distinct from the root API's public callback origin. Existing NEXT_PUBLIC_API_URL can remain; it contains no credentials.
4. In OPay dashboard webhook settings, configure `https://<your-api-tunnel-host>/payments/opay/webhook`. The create API also sends that callback URL explicitly. Return/cancel URLs point at Anka's `/payment/callback?reference=<internal Payment.reference>`.
5. Open PowerShell at the repository root:

```powershell
Set-Location C:\Users\HomePC\Desktop\anka-wifi
pnpm --filter api exec prisma generate --config prisma7.config.ts
pnpm --filter api exec prisma migrate deploy --config prisma7.config.ts
pnpm --filter api build
pnpm --filter web build
pnpm dev
```

The API runs on 4000 and web on 3000. Use the existing authenticated admin Packages/Access Codes screens to create/activate a test package and upload available test inventory. Do not use real production access codes for sandbox checks.

## Exercise the API and cashier

You can use the homepage checkout (choose OPay) or these PowerShell requests. Only package ID, phone/email and provider are client inputs; do not send amount/status/code fields.

```powershell
$ankaApi = 'http://localhost:4000'
$ankaPlans = Invoke-RestMethod "$ankaApi/packages"
$ankaPlan = $ankaPlans | Where-Object status -eq 'ACTIVE' | Select-Object -First 1
if (-not $ankaPlan) { throw 'Create an active test package first.' }
$ankaPurchase = Invoke-RestMethod "$ankaApi/purchases" -Method Post -ContentType 'application/json' -Body (@{
  packageId = $ankaPlan.id
  phone = '08012345678'
  email = 'sandbox@example.com'
} | ConvertTo-Json)
$ankaCheckout = Invoke-RestMethod "$ankaApi/payments/initialize" -Method Post -ContentType 'application/json' -Body (@{
  purchaseReference = $ankaPurchase.reference
  provider = 'OPAY'
} | ConvertTo-Json)
$ankaCheckout | Select-Object purchaseReference, paymentReference, provider, authorizationUrl
Start-Process $ankaCheckout.authorizationUrl
```

Use the [current official sandbox scenarios](https://documentation.opaycheckout.com/end-to-end-testing). These three documented PIN cases cover the required outcomes; use only in test mode:

| Outcome | Test card | Expiry | CVV | PIN | OTP |
| --- | --- | --- | --- | --- | --- |
| SUCCESS | 5061460410121111104 | 12/99 | 560 | 1104 | 543210 |
| PENDING | 5061460410121111101 | 12/99 | 557 | 1102 | 543210 |
| FAIL | 5061460410121111107 | 12/99 | 563 | 1107 | 123456 |

Create a separate Purchase for each scenario. Paystack/OPay attempts for an unresolved Purchase cannot run together.

After checkout returns, or to independently check a saved reference:

```powershell
Invoke-RestMethod "$ankaApi/payments/verify/$($ankaCheckout.paymentReference)"
```

SUCCESS returns the code only after database fulfillment: Payment OPAY/SUCCESSFUL with orderNo and paidAt, Purchase COMPLETED with completedAt, assigned AccessCode SOLD with soldAt and cleared reservation timestamps. Repeated verification/notification returns the same code and timestamps. Admin payment/purchase details show actual stored provider and all attempts.

PENDING and FAIL return HTTP 400 with safe `paymentState`; neither returns a code or releases a reservation through public verification. Failure stays locally pending until the existing admin reconciliation operation confirms and atomically releases it. For attempts at least 15 minutes old, an authenticated operator can invoke `POST /admin/payments/reconcile` with `{"limit":5}` using the existing admin Bearer token. Follow returned `nextAfterId` for the next bounded page; do not mark payment successful manually. Unknown/mismatched/unreachable states stay reserved and emit attention logs.

If initialization returns 502, save the supplied internal paymentReference. Check it before paying again; do not infer failure from the timeout. The browser stores the reference for recovery. If the complete response is lost, a subsequent initialize request returns 409 with the unresolved paymentReference without creating another attempt.

OPay callbacks authenticate without admin JWT. They acknowledge HTTP 200; no response body is required by OPay. Non-2xx responses are retried for up to 72 hours according to the [notification specification](https://documentation.opaycheckout.com/payment-notifications-callbacks). Keep raw-body support enabled for Paystack as before.

## Automated validation

```powershell
Set-Location C:\Users\HomePC\Desktop\anka-wifi\apps\api
pnpm test
pnpm exec tsc --noEmit --incremental false
pnpm lint
# Strict standard lint while the existing type-aware checker cannot parse node10:
pnpm exec oxlint --deny-warnings src/ test/
pnpm build
$env:RUN_PAYMENT_DB_TESTS = '1'
try { pnpm test:e2e } finally { Remove-Item Env:RUN_PAYMENT_DB_TESTS -ErrorAction SilentlyContinue }

Set-Location ..\web
pnpm typecheck
pnpm lint
pnpm build
node scripts/smoke-test.mjs
$env:ANKA_SMOKE_DEV = '1'
$env:ANKA_SMOKE_BROWSER = '1'
try { node scripts/smoke-test.mjs } finally {
  Remove-Item Env:ANKA_SMOKE_DEV -ErrorAction SilentlyContinue
  Remove-Item Env:ANKA_SMOKE_BROWSER -ErrorAction SilentlyContinue
}
node scripts/admin-operations-smoke.mjs
```

Database tests create/drop only a random isolated schema. Frontend tests use isolated mocked API/provider redirects and never initialize real charges. Chrome is used by the optional browser smoke; set ANKA_BROWSER_PATH if it is installed elsewhere. Browser screenshots remain in ignored `.next/admin-smoke/browser`.

Validation on this change: 148 unit tests and 62 integration tests passed (including 13 live PostgreSQL cases). Both builds and TypeScript validation passed. Frontend ESLint and strict standard API Oxlint passed; the existing type-aware API lint configuration limitation is described above. The headless Chrome desktop/mobile smoke passed provider selection/redirects, unknown initialization recovery, pending/failed states, spoofed return parameters, backend-confirmed code/provider, and existing admin login/logout/chart/form checks. The final production frontend proxy/auth/customer smoke passed with the runtime API destination. The admin operations API/protected-route smoke passed with mixed-provider fixtures; final provider-reference assertions were also rerun.
