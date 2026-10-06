# Anka WiFi customer frontend

See [the admin operations report](./ADMIN_OPERATIONS.md) for Access Codes, Purchases and Payments routes, backend contracts, verification and remaining reporting limitations.

The existing Next.js App Router frontend provides a public, account-free Wi-Fi purchase journey.

## Configuration

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to the Anka API origin (development: `http://localhost:4000`). No private secrets belong in the frontend.

Configure `FRONTEND_URL` in the backend to this frontend's origin. The backend creates the Paystack callback URL at `/payment/callback`. Paystack keys remain on the backend.

Browser requests use a restricted `/api/customer/...` route handler. It forwards only the four public customer operations, avoids a browser CORS dependency, and does not forward cookies or admin credentials. Error details are sanitized and responses are not cached. Production infrastructure should enforce per-client rate limits at the public frontend boundary; the existing backend sees forwarded requests coming from the frontend server.

## Backend contracts

- `GET /packages`: current active package catalog. The UI additionally filters ACTIVE status; no sample catalog, price, duration, device count or inventory is fabricated.
- `POST /purchases`: `{ packageId, phone, email }`; returns a random purchase reference. Amounts are determined entirely by the backend.
- `POST /payments/initialize`: `{ purchaseReference }`; returns purchase/payment references and a backend-provided authorization URL.
- `GET /payments/verify/:reference`: verifies a random payment reference and returns the completed package, purchase reference and access code.

Prices are formatted from Prisma Decimal strings without floating point conversion. Featured badges follow the backend `featured` flag.

## Customer flow

The catalog has skeleton, empty and retry states. A native modal dialog provides keyboard focus containment, Escape dismissal, focus restoration, labelled email/phone fields, and duplicate-submit protection. Phone formatting characters are removed, then the value is validated against the backend's 7 to 15 digit contract. Phone and email use shared Zod validation through React Hook Form. After creation, initialization retries reuse the same purchase reference. The browser redirects to the returned HTTPS authorization URL.

`/payment/callback` accepts `reference` or Paystack's `trxref`, asks the backend to verify payment, and displays a code only for a completed purchase and successful payment. It provides clipboard copying and neutral wording when payment cannot yet be confirmed. `/payment/check` uses the same verification endpoint with a payment reference, never a customer phone/email lookup. Session storage optionally remembers the last payment reference; codes and contact details are not stored there.

## Development and checks

```sh
pnpm --filter web dev
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web build
node apps/web/scripts/smoke-test.mjs
```

The smoke test requires a production build and starts isolated frontend/mock backend servers. It checks rendered routes, package ready/empty/error API contracts, exact purchase payload forwarding, initialization, verification, no-store responses and the proxy allowlist. Its fixtures are test-only; production never uses them. It makes no real Paystack payment.

Remaining release verification: run an actual Paystack test-mode round trip with a configured backend and available access-code inventory, and manually verify mobile layout, dialog keyboard behavior and clipboard permissions in target browsers. No browser automation dependency has been added.

## Frontend data and forms

`app/providers.tsx` supplies the App Router client QueryClientProvider. The server gets an isolated QueryClient; the browser retains one client. `lib/queries.ts` owns the package and payment-verification queries and the purchase, payment-initialization, admin-login and logout mutations. Package queries filter ACTIVE results. Financial and login mutations do not retry automatically. Payment verification disables automatic focus/reconnect refetching and discards inactive results immediately; a customer can explicitly check again.

Checkout, payment recovery and admin login use React Hook Form with `@hookform/resolvers/zod`. Shared schemas live in `lib/schemas/customer.ts` and `lib/schemas/admin.ts`. RHF owns field values, errors and submission state. Mutation data retains the purchase reference so an initialization retry reuses the original purchase. Frontend validation improves feedback; the backend still validates requests and decides prices, inventory, payment outcomes and admin authorization.

## Staff login

A small lock-icon Admin Login link lives in the footer bottom row beside the copyright and routes to `/admin/login`. It is not added to the customer navigation. The staff form authenticates against the real `POST /admin/auth/login` endpoint through `/api/admin/login`, using the same configured API origin. The frontend server validates the response, stores the JWT in an HttpOnly, SameSite=Strict cookie (Secure in production), and returns only staff identity and expiry to the browser. Same-origin checks protect login/logout requests. No token is placed in localStorage, sessionStorage or client response JSON.

Successful login redirects to `/admin`; an authenticated visit to `/admin/login`
also redirects there. `/admin` and `/admin/packages` use the protected route-group
layout. It validates the cookie with the backend's guarded `GET /admin/auth/me`
before rendering and passes only the admin identity to the browser. This small
identity endpoint was added for session validation; it does not change JWT behavior.
Include it in your next API build/restart. Logout clears the HttpOnly cookie and
Query cache, then redirects to login. Expired sessions redirect to login when an
API request returns 401. Tokens/passwords remain out of browser storage.

## Admin dashboard and package management

The shared `AdminShell` provides the fixed/collapsible navy sidebar, authenticated
identity, logout and a native-dialog mobile drawer. Dashboard and Packages are
active navigation routes. This pass implements Dashboard and Packages and preserves
concurrent work on Access Codes, Purchases and Payments navigation. No fake
notifications are added. The customer homepage
and customer checkout retain their existing layout and APIs.

`Dashboard` reads five recent purchases from `GET /admin/purchases?limit=5&offset=0`
through the allowlisted same-origin proxy. Only reference, package name, phone,
amount, status and date reach its browser response; payment metadata, customer
email and access codes are stripped. Dates use Africa/Lagos. Loading, empty,
error/retry and mobile-card states are provided.

`PackagesManager` uses `GET /admin/packages?limit=100&offset=...`, then local search,
type/status filters and six-row presentation pages. It fetches bounded pages up
to 10,000 records; larger datasets show a truncation message and suppress totals.
Complete datasets provide real total/active/inactive counts and a price average
calculated with integer kobo using BigInt. This descriptive package average is
not revenue. Package creation uses `POST /admin/packages`; editing and activation
use `PATCH /admin/packages/:id`. There is no deletion action.

`PackageForm` uses RHF, Zod and TanStack mutations for name (trimmed, 1–120), type,
positive price (at most two decimal places, maximum 99,999,999.99), optional
description (at most 2,000) and status. The same form serves desktop create/edit
panels and a focus-trapping mobile dialog. Prices stay decimal strings in UI
state; the server proxy converts them to JSON numbers solely because the existing
Nest DTO requires numeric price input. No arithmetic occurs during conversion.
IDs/timestamps are never sent. Mutations disable duplicate submissions, show
safe feedback and invalidate both admin package data and customer package data.

Admin HTTP communication lives in `lib/admin-management.ts`, server session checks
in `lib/admin-session.ts`, validation in `lib/schemas/admin-package.ts`, and the
allowlisted Bearer-token proxy in `app/api/admin/[...path]/route.ts`. This pass uses
package GET/POST/PATCH and purchase GET; concurrent operation-route extensions
are preserved. Writes enforce same-origin requests,
errors are sanitized and responses use no-store. Backend guards authorize every
resource request. All admin queries and mutations use TanStack Query; there is no
useEffect fetching and no Axios, extra state/form library or UI framework.

Query keys are `['admin','packages']`, `['admin','dashboard','recent-purchases']`
and `['admin','reports','overview']`. The package mutations invalidate admin
packages/dashboard plus `['packages']` for the customer storefront. The original
shared QueryClientProvider remains in use.

Files added or updated for this pass:

| Area                | Files                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI           | `components/admin/AdminShell.tsx`, `AdminIcon.tsx`, `AdminUI.tsx`                                                                                                            |
| Dashboard           | `components/admin/Dashboard.tsx`, `DashboardCharts.tsx`, `lib/admin-analytics.ts`                                                                                            |
| Package forms/list  | `components/admin/PackageForm.tsx`, `PackagesManager.tsx`, `lib/schemas/admin-package.ts`                                                                                    |
| Authentication/data | `components/admin/AdminLogin.tsx`, `lib/admin-session.ts`, `lib/admin-management.ts`                                                                                         |
| Routes              | `app/admin/layout.tsx`, `error.tsx`, `login/page.tsx`, `(protected)/layout.tsx`, `(protected)/page.tsx`, `(protected)/packages/page.tsx`, `app/api/admin/[...path]/route.ts` |
| Verification/config | `scripts/smoke-test.mjs`, `scripts/admin-browser-check.mjs`, `next.config.ts`, `package.json`, `tsconfig.json`, root `pnpm-lock.yaml`, frontend/API READMEs                  |
| Backend identity    | `apps/api/src/admin/admin-auth.controller.ts` (`GET /admin/auth/me`)                                                                                                         |

## Dashboard charts and missing APIs

Recharts is the only chart dependency. `DashboardCharts` uses `AreaChart` for
Sales Overview and Payment Volume, and `PieChart` for Payment Status and Package
Sales. Each populated chart uses `ResponsiveContainer`, readable tooltips, exact
Naira labels for server monetary strings and an accessible textual alternative.
Numbers are used only for chart geometry, never to calculate revenue. Chart
loading skeletons, errors/retry, empty states and mobile sizing are included.

The authenticated `GET /admin/reports/overview` endpoint supplies database-wide totals, status counts and chart series. TanStack Query uses `['admin','reports','overview']`, validates responses with Zod, and refreshes every minute. Code and package mutations invalidate reporting. Summary cards on Dashboard, Purchases, Payments, Access Codes and Packages use this source instead of counting paginated rows.

Totals are all-time. Revenue counts completed purchase amounts once, regardless of payment retries. Payment volume includes only successful NGN payments by `paidAt`. Sales use `completedAt`. Series cover 30 days, 12 Monday-based weeks, or 12 months including the current period, in Africa/Lagos. Missing activity fills zero buckets; failed requests show retry errors. Status distribution counts all payment attempts, including refunds. Package sales count completed purchases grouped by package name. Recent Activity lists actual recent purchase creation events rather than an audit log.

Database reporting tests run against a randomly named isolated schema with `RUN_REPORTING_DB_TESTS=1 pnpm --filter api test:e2e -- reports-postgres.e2e-spec.ts` after the API build. They cover empty datasets, decimal money, payment retries and Lagos calendar boundaries.

## Admin checks without a production build

Only `NEXT_PUBLIC_API_URL` is needed in `apps/web/.env.local`; backend JWT,
database and Paystack secrets stay server-only. Use the same Nest API origin as
customer flows, for example `http://localhost:4000`.

```powershell
# From apps/web:
pnpm typecheck
pnpm lint -- --max-warnings=0
$env:ANKA_SMOKE_DEV = '1'
$env:ANKA_SMOKE_BROWSER = '1'
try { node scripts/smoke-test.mjs } finally {
  Remove-Item Env:ANKA_SMOKE_DEV
  Remove-Item Env:ANKA_SMOKE_BROWSER
}
```

Dev smoke mode uses a separate `.next/admin-smoke` cache and mocked API, without
building or modifying real packages. It verifies customer/API contracts, protected
pages, login redirect, cookie isolation, create/edit/status proxy operations,
validation, origin checks and safe failure handling. Optional browser checks use
installed Chrome through its native debugging protocol; no browser dependency
is added. Set `ANKA_BROWSER_PATH` for a different installed Chromium executable.
Browser checks cover login/logout, real RHF package submission and Query cache
invalidation, desktop/mobile overflow, drawer and mobile form. Screenshots are
saved under `.next/admin-smoke/browser` and are ignored by Git. Without dev mode,
the smoke script continues to use your existing production build.

Remaining work for this pass: a dedicated audit/activity source,
deployment build verification and a real backend package round
trip after the API is rebuilt. No real data is written by these smoke tests.

The production smoke test also checks login credential normalization, validation, origin enforcement, token isolation, cookie flags/expiry, invalid credentials, throttling, malformed upstream responses and logout. Browser checks exercise RHF checkout/admin validation, retrying initialization without recreating a purchase, redirects, and uncertain/successful payment verification with Query-managed state.

## OPay checkout

Checkout offers Paystack and OPay. Provider choice is sent to the same backend initialization endpoint; the browser only redirects to the normalized checkout URL and verifies on return. Uncertain attempts retain their recovery reference and prevent starting another attempt in the dialog.

Use server-only `API_URL` in `.env.local` to configure the runtime backend proxy destination; `NEXT_PUBLIC_API_URL` remains a compatibility fallback. OPay merchant keys belong exclusively in the root backend `.env`. See [the OPay implementation report and Windows sandbox guide](../api/OPAY.md).
