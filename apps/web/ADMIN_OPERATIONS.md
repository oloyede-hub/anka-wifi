# Admin operations report

1. **Routes:** `/admin/access-codes`, `/admin/purchases`, `/admin/payments` reuse the existing protected layout/session check. Sidebar links and header labels include all three.

2. **Components:** Reused `AdminShell`, `AdminIcon`, `StatCard`, `StatusBadge`, `QueryError`, `RowsSkeleton`, `MoneyAreaCard` and `DistributionCard`. Added shared controls, pagination, native dialog sheets, fields, empty states, clipboard feedback and date/time formatting in `OperationsUI`. Screens compose `AccessCodesManager`, `AccessCodeForm`, `TransactionsManager` and `OperationDetails`. Desktop tables become mobile cards. Native modal sheets trap focus, close with Escape and fill mobile width.

3. **Backend endpoints:** Requests use the existing same-origin authenticated `/api/admin/[...path]` proxy, forwarding its HttpOnly cookie token to guarded Nest endpoints:

   | Method | Backend route | Purpose |
   | --- | --- | --- |
   | GET | `/admin/packages` | Real package options |
   | GET | `/admin/access-codes` | Inventory with status/package filters and limit/offset |
   | POST | `/admin/access-codes` | Add one existing code |
   | POST | `/admin/access-codes/bulk` | Add `{ packageId, codes }` |
   | POST | `/admin/access-codes/:id/disable` | Guarded unused-code transition |
   | GET | `/admin/purchases` | Status/exact reference/exact phone filtering |
   | GET | `/admin/purchases/:reference` | All purchase relationships and attempts |
   | GET | `/admin/payments` | Status/exact purchase-reference filtering |
   | GET | `/admin/payments/:reference` | Payment attempt and linked purchase |

   Existing `/admin/auth/me` and login/logout remain in use. Origin checks, response schemas, sanitized errors and no-store caching are preserved. A 401 deletes the cookie, clears admin queries and returns to login. No backend or webhook code changed.

4. **Access codes:** Status/package filters use the backend. Search and local pagination operate only on complete matching inventory. Global counts use complete unfiltered inventory. Individual and newline-separated bulk entry require a package and eight non-whitespace characters per code; bulk accepts 1–1,000 entries and displays real created/skipped/duplicate/existing counts. Clipboard feedback is accessible. Available codes without reservation/sold timestamps can be disabled after confirmation; backend relationship/transition checks remain authoritative. `soldAt` is labeled Sold At, never Used At.

5. **Purchases:** Read-only server pagination, working status tabs and exact reference/phone search. Tables show customer, package, amount, dates, attempt counts and actual distinct attempt statuses. No single payment summary is fabricated. Details show every payment attempt and attached access code, if present.

6. **Payments:** Read-only attempt listing, real status tabs including Refunded, exact purchase-reference filtering, amount/provider/date columns and responsive details. Customer/package details come from the protected purchase-detail endpoint because payment responses only expose the linked purchase reference/status/package ID. Purchase references open purchase details.

7. **Recharts:** The authenticated database reporting endpoint supplies sales/payment series and status/package distributions. Existing responsive charts display the returned figures; percentages derive from actual counts. Daily/weekly/monthly controls select real report periods.


8. **Missing backend capabilities:** code substring search, file upload, hotspot code generation and safe provider dashboard URLs. Purchase list filtering lacks package/email/date; payment list filtering lacks payment reference/customer/package/date. Payment responses omit provider transaction IDs/provider references.

9. **Intentional omissions:** No generated codes, multipart uploads, fake exports/notifications/reports, provider URLs, refunds, arbitrary status edits, manual fulfillment or reconciliation controls. Bulk uses the existing JSON endpoint. Summary cards use database-wide reporting totals rather than current-page counts. Other existing provider enum values can be displayed if returned, but no new provider integration was introduced.

10. **TanStack Query:** Added `['admin', 'access-codes', { status, packageId }]`, `['admin', 'purchases' | 'payments', filters, page]`, `['admin', 'purchase', reference]`, `['admin', 'payment', reference]`. `useAddCodes` and `useDisableCode` mutations invalidate access-code and reporting queries. Existing providers/package/analytics queries are reused. Purchase/payment queries fetch 11 rows to show 10 and determine Next without invented total pages. No API fetching uses effects; the sheet effect controls only native dialog opening.

11. **Forms/schemas:** RHF with Zod resolvers handles individual and bulk code forms. Separate reusable schemas in `src/lib/schemas/admin-operations.ts` validate forms, proxy inputs and real response projections. Simple filters remain local state. No dependencies or global state libraries were added.

12. **Files changed:**

   - Added protected `access-codes/page.tsx`, `purchases/page.tsx`, `payments/page.tsx`.
   - Added `src/lib/admin-operations.ts`, `src/lib/schemas/admin-operations.ts`.
   - Added `src/components/admin/OperationsUI.tsx`, `AccessCodeForm.tsx`, `AccessCodesManager.tsx`, `OperationDetails.tsx`, `TransactionsManager.tsx`.
   - Updated `src/app/api/admin/[...path]/route.ts`, `src/lib/admin-management.ts`, `src/components/admin/AdminShell.tsx`, `AdminUI.tsx`, `DashboardCharts.tsx`.
   - Added `scripts/admin-operations-smoke.mjs`, this report and its README link.

13. **Typecheck:** `pnpm --filter web typecheck` passed.

14. **Lint:** `pnpm --filter web lint` passed.

15. **Build and integration checks:** `pnpm --filter web build` passed. Isolated mock-backend checks passed for protected routes, authenticated forwarding, response shapes, pagination/filters, invalid bodies, origins, duplicate handling, guarded disable conflicts, forbidden reconciliation and expired sessions. Playwright/Edge checks passed for desktop/mobile layouts and sheets, clipboard, bulk validation/results, disable, multiple attempts, related customer details, empty/error/retry states, navigation, no page overflow and login expiry. Existing customer/auth/Packages regression checks also passed. Fixtures do not prove a deployed database/provider round trip and never modify real business data.

16. **Remaining work and limits:** Add backend list filters before exposing corresponding UI controls. Confirm a live authenticated read/import flow in the target deployment with staff credentials. Complete inventory loading is capped at 10,000 codes; beyond that, results/search require narrower status/package filters and global totals still include all records. Larger inventories need server search/counts. Offset pagination respects the backend maximum offset of 100,000. The API does not offer snapshot-consistent pagination while records change.

## Running isolated checks

From `apps/web`, run `node scripts/admin-operations-smoke.mjs`. It uses an isolated Next development cache and a local fixture API so build-time public environment substitution cannot redirect fixture operations to a real backend.

For browser coverage, set `ANKA_PLAYWRIGHT_MODULE` to an absolute path to an externally available Playwright module. The script uses installed Edge and saves a desktop payment-sheet capture under `.next/operations-smoke/browser/`. No browser dependency was added to the application.

Run existing regressions with `ANKA_SMOKE_DEV=1 node scripts/smoke-test.mjs`, using the appropriate environment-variable syntax for your shell.
