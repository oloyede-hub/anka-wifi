import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as pause } from "node:timers/promises";
import { mkdir } from "node:fs/promises";

// Isolated fixtures exercise the actual proxy and UI. No real customers, codes or charges are modified.
const requests = [];
let expired = false;
let unavailable = false;
const stamp = "2026-09-30T09:45:00.000Z";
const plan = {
  id: "plan-1",
  name: "Test Wi-Fi package",
  type: "DAILY",
  price: "1200.50",
  description: null,
  status: "ACTIVE",
  featured: false,
  createdAt: stamp,
  updatedAt: stamp,
};
const codes = ["AVAILABLE", "RESERVED", "SOLD", "DISABLED"].map(
  (status, index) => ({
    id: `code-${index}`,
    code: `TEST000${index}`,
    status,
    packageId: plan.id,
    package: plan,
    reservedAt: status === "RESERVED" ? stamp : null,
    reservationExpiresAt: status === "RESERVED" ? stamp : null,
    soldAt: status === "SOLD" ? stamp : null,
    createdAt: stamp,
    updatedAt: stamp,
  }),
);
const attempts = ["FAILED", "FAILED", "SUCCESSFUL"].map((status, index) => ({
  reference: `PAY-test-${index}`,
  status,
  provider: index === 0 ? "PAYSTACK" : "OPAY",
  providerReference: status === "SUCCESSFUL" ? "OPAY-order-test-2" : null,
  amount: "1200.50",
  currency: "NGN",
  paidAt: status === "SUCCESSFUL" ? stamp : null,
  createdAt: stamp,
}));
const purchases = Array.from({ length: 12 }, (_, index) => ({
  id: `purchase-${index}`,
  reference: `ANK-test-${index}`,
  packageId: plan.id,
  amount: "1200.50",
  status: index === 0 ? "COMPLETED" : "PENDING",
  createdAt: stamp,
  completedAt: index === 0 ? stamp : null,
  package: { id: plan.id, name: plan.name, type: plan.type },
  customer: {
    id: "customer-1",
    phone: "08012345678",
    email: "test@example.com",
  },
  accessCode:
    index === 0
      ? { id: codes[2].id, code: codes[2].code, status: "SOLD", soldAt: stamp }
      : null,
  payment: index === 0 ? attempts : [],
}));
const payments = attempts.map((item) => ({
  ...item,
  purchase: {
    reference: purchases[0].reference,
    status: "COMPLETED",
    packageId: plan.id,
  },
}));
const backend = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const url = new URL(req.url, "http://localhost");
  requests.push({ url, method: req.method, body });
  res.setHeader("Content-Type", "application/json");
  if (
    expired ||
    req.headers.authorization !== "Bearer header.payload.signature"
  ) {
    res.writeHead(401);
    res.end('{"message":"private diagnostic"}');
    return;
  }
  if (unavailable && url.pathname === "/admin/purchases") {
    res.writeHead(503);
    res.end("{}");
    return;
  }
  const page = (items) =>
    items.slice(
      Number(url.searchParams.get("offset") ?? 0),
      Number(url.searchParams.get("offset") ?? 0) +
        Number(url.searchParams.get("limit") ?? 50),
    );
  let result;
  if (url.pathname === "/admin/auth/me")
    result = { id: "admin-1", name: "Test Admin", email: "staff@example.com" };
  else if (url.pathname === "/admin/reports/overview") {
    const summary = (items, statuses) => ({
      total: items.length,
      statuses: Object.fromEntries(
        statuses.map((status) => [
          status,
          items.filter((item) => item.status === status).length,
        ]),
      ),
    });
    const series = {
      daily: [{ label: "29 Sep", amount: "0.00" }, { label: "30 Sep", amount: "1200.50" }],
      weekly: [{ label: "21 Sep", amount: "0.00" }, { label: "28 Sep", amount: "1200.50" }],
      monthly: [{ label: "Aug 2026", amount: "0.00" }, { label: "Sep 2026", amount: "1200.50" }],
    };
    const paymentSummary = summary(payments, [
      "PENDING",
      "SUCCESSFUL",
      "FAILED",
      "REFUNDED",
    ]);
    result = {
      asOf: stamp,
      timeZone: "Africa/Lagos",
      currency: "NGN",
      totals: {
        purchases: purchases.length,
        revenue: "1200.50",
        codesSold: codes.filter((c) => c.status === "SOLD").length,
        availableCodes: codes.filter((c) => c.status === "AVAILABLE").length,
      },
      summaries: {
        purchases: summary(purchases, [
          "PENDING",
          "COMPLETED",
          "FAILED",
          "CANCELLED",
        ]),
        payments: paymentSummary,
        accessCodes: summary(codes, [
          "AVAILABLE",
          "RESERVED",
          "SOLD",
          "DISABLED",
        ]),
        packages: {
          ...summary([plan], ["ACTIVE", "INACTIVE"]),
          averagePrice: plan.price,
        },
      },
      sales: series,
      paymentVolume: series,
      paymentStatus: Object.entries(paymentSummary.statuses).map(
        ([label, count]) => ({
          label: label.charAt(0) + label.slice(1).toLowerCase(),
          count,
        }),
      ),
      packageSales: [{ label: plan.name, count: 1 }],
    };
  } else if (url.pathname === "/admin/packages") result = [plan];
  else if (url.pathname === "/admin/access-codes/bulk") {
    const input = JSON.parse(body);
    const unique = [...new Set(input.codes)];
    const existing = unique.filter((code) =>
      codes.some((item) => item.code === code),
    );
    const fresh = unique.filter((code) => !existing.includes(code));
    fresh.forEach((code) =>
      codes.push({ ...codes[0], id: `new-${code}`, code }),
    );
    result = {
      requested: input.codes.length,
      created: fresh.length,
      skipped: input.codes.length - fresh.length,
      duplicatesInRequest: input.codes.length - unique.length,
      alreadyStored: existing.length,
    };
  } else if (/\/admin\/access-codes\/.+\/disable$/.test(url.pathname)) {
    const code = codes.find((item) => item.id === url.pathname.split("/")[3]);
    if (!code || code.status !== "AVAILABLE") {
      res.writeHead(409);
      res.end("{}");
      return;
    }
    code.status = "DISABLED";
    result = code;
  } else if (url.pathname === "/admin/access-codes" && req.method === "POST") {
    const input = JSON.parse(body);
    if (codes.some((item) => item.code === input.code)) {
      res.writeHead(409);
      res.end("{}");
      return;
    }
    result = {
      ...codes[0],
      ...input,
      id: `new-${input.code}`,
      status: "AVAILABLE",
    };
    codes.push(result);
  } else if (url.pathname === "/admin/access-codes")
    result = page(
      codes.filter(
        (item) =>
          (!url.searchParams.get("status") ||
            item.status === url.searchParams.get("status")) &&
          (!url.searchParams.get("packageId") ||
            item.packageId === url.searchParams.get("packageId")),
      ),
    );
  else if (url.pathname === "/admin/purchases")
    result = page(
      purchases.filter(
        (item) =>
          (!url.searchParams.get("status") ||
            item.status === url.searchParams.get("status")) &&
          (!url.searchParams.get("reference") ||
            item.reference === url.searchParams.get("reference")) &&
          (!url.searchParams.get("phone") ||
            item.customer.phone === url.searchParams.get("phone")),
      ),
    );
  else if (url.pathname.startsWith("/admin/purchases/"))
    result = purchases.find(
      (item) => item.reference === url.pathname.split("/").at(-1),
    );
  else if (url.pathname === "/admin/payments")
    result = page(
      payments.filter(
        (item) =>
          (!url.searchParams.get("status") ||
            item.status === url.searchParams.get("status")) &&
          (!url.searchParams.get("purchaseReference") ||
            item.purchase.reference ===
              url.searchParams.get("purchaseReference")),
      ),
    );
  else if (url.pathname.startsWith("/admin/payments/"))
    result = payments.find(
      (item) => item.reference === url.pathname.split("/").at(-1),
    );
  if (!result) {
    res.writeHead(404);
    res.end("{}");
  } else res.end(JSON.stringify(result));
});
await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
const base = "http://localhost:4318";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-p", "4318"],
  {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backend.address().port}`,
      API_URL: `http://127.0.0.1:${backend.address().port}`,
      ANKA_WEB_DIST_DIR: ".next/operations-smoke",
    },
    windowsHide: true,
    stdio: "pipe",
  },
);
let log = "";
child.stdout.on("data", (chunk) => {
  log += chunk;
});
child.stderr.on("data", (chunk) => {
  log += chunk;
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(500);
  }
  assert(ready, log);
  const cookie = "anka-admin-session=header.payload.signature";
  const call = (path, body, origin = base) =>
    fetch(`${base}/api/admin/${path}`, {
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      ...(body !== undefined
        ? { method: "POST", body: JSON.stringify(body) }
        : {}),
    });
  for (const route of ["access-codes", "purchases", "payments"]) {
    const protectedResponse = await fetch(`${base}/admin/${route}`, {
      redirect: "manual",
    });
    assert.equal(protectedResponse.status, 307);
    assert.match(protectedResponse.headers.get("location"), /admin\/login/);
    assert.equal(
      (await fetch(`${base}/admin/${route}`, { headers: { Cookie: cookie } }))
        .status,
      200,
    );
    assert.equal((await fetch(`${base}/api/admin/${route}`)).status, 401);
  }
  assert.equal(
    (
      await (
        await call(
          "access-codes?status=SOLD&packageId=plan-1&limit=100&offset=0",
        )
      ).json()
    ).length,
    1,
  );
  assert.equal(requests.at(-1).url.searchParams.get("packageId"), "plan-1");
  assert.equal((await call("access-codes?status=BAD")).status, 400);
  assert.equal((await call("payments?limit=101")).status, 400);
  assert.equal(
    (await (await call("purchases?limit=11&offset=10")).json()).length,
    2,
  );
  assert.equal(
    (await (await call("purchases?limit=11&status=COMPLETED")).json()).length,
    1,
  );
  const details = await (await call("purchases/ANK-test-0")).json();
  assert.equal(details.payment.length, 3);
  assert.equal(details.payment[2].status, "SUCCESSFUL");
  assert.equal(details.payment[0].provider, "PAYSTACK");
  assert.equal(details.payment[2].provider, "OPAY");
  assert.equal(details.payment[2].providerReference, "OPAY-order-test-2");
  assert.equal(details.accessCode.soldAt, stamp);
  assert.equal(
    (await (await call("purchases/ANK-test-1")).json()).accessCode,
    null,
  );
  assert.equal(
    (await (await call("payments/PAY-test-2")).json()).purchase.reference,
    "ANK-test-0",
  );
  assert.equal(
    (await (await call("payments/PAY-test-2")).json()).providerReference,
    "OPAY-order-test-2",
  );
  assert.equal(
    (
      await (
        await call(
          "payments?limit=11&status=SUCCESSFUL&purchaseReference=ANK-test-0",
        )
      ).json()
    ).length,
    1,
  );
  assert.equal(
    (await call("access-codes", { packageId: plan.id, code: "short" })).status,
    400,
  );
  assert.equal(
    (
      await call("access-codes", {
        packageId: plan.id,
        code: "NEW00001",
        status: "SOLD",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "access-codes",
        { packageId: plan.id, code: "NEW00001" },
        "https://other.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("access-codes", { packageId: plan.id, code: "NEW00001" }))
      .status,
    200,
  );
  assert.equal(
    (await call("access-codes", { packageId: plan.id, code: "NEW00001" }))
      .status,
    409,
  );
  const bulk = await (
    await call("access-codes/bulk", {
      packageId: plan.id,
      codes: ["NEW00002", "NEW00002", "NEW00001"],
    })
  ).json();
  assert.equal(bulk.created, 1);
  assert.equal(bulk.duplicatesInRequest, 1);
  assert.equal(bulk.alreadyStored, 1);
  assert.equal((await call("access-codes/code-2/disable", {})).status, 409);
  assert.equal((await call("payments/reconcile", {})).status, 404);
  if (process.env.ANKA_PLAYWRIGHT_MODULE) {
    const { chromium } = createRequire(import.meta.url)(
      process.env.ANKA_PLAYWRIGHT_MODULE,
    );
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.addCookies([
      {
        name: "anka-admin-session",
        value: "header.payload.signature",
        url: base,
      },
    ]);
    const page = await context.newPage();
    const artifacts = new URL(
      "../.next/operations-smoke/browser/",
      import.meta.url,
    );
    await mkdir(artifacts, { recursive: true });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base + "/admin/access-codes");
    await page
      .getByRole("cell", { name: "Test Wi-Fi package", exact: true })
      .first()
      .waitFor();
    assert(
      await page
        .getByRole("heading", { name: "Access Codes", exact: true })
        .first()
        .evaluate((element) =>
          getComputedStyle(element)
            .fontFamily.toLowerCase()
            .includes("montserrat"),
        ),
      "Admin screens must inherit the configured font",
    );
    assert(
      await page.evaluate(
        () =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--color-chart-primary")
            .trim().length > 0,
      ),
      "Chart tokens must be available to SVG charts",
    );
    assert(
      await page
        .getByRole("button", { name: "Bulk add codes", exact: true })
        .evaluate((element) => {
          const probe = document.createElement("span");
          probe.style.backgroundColor = "var(--color-brand)";
          document.body.append(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return (
            expected !== "rgba(0, 0, 0, 0)" &&
            getComputedStyle(element).backgroundColor === expected
          );
        }),
      "Shared primary buttons must resolve the brand theme color",
    );
    await page.getByLabel("Search code", { exact: true }).fill("TEST0002");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("button", { name: "Copy code TEST0002", exact: true })
      .filter({ visible: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Copied" })
      .first()
      .waitFor();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page
      .getByRole("button", { name: "Bulk add codes", exact: true })
      .click();
    let dialog = page.getByRole("dialog", {
      name: "Bulk add access codes",
      exact: true,
    });
    await dialog.getByLabel("Package", { exact: true }).selectOption(plan.id);
    await dialog.getByLabel("Codes", { exact: true }).fill("invalid");
    await dialog
      .getByRole("button", { name: "Add codes", exact: true })
      .click();
    await dialog.getByRole("alert").filter({ hasText: "exactly 8" }).waitFor();
    await dialog
      .getByLabel("Codes", { exact: true })
      .fill("NEW00003\nNEW00003\nNEW00001");
    await dialog
      .getByRole("button", { name: "Add codes", exact: true })
      .click();
    await dialog
      .getByRole("status")
      .filter({ hasText: "Created 1 of 3" })
      .waitFor();
    await dialog
      .getByRole("button", { name: "Close Bulk add access codes" })
      .click();
    await page.getByLabel("Status", { exact: true }).selectOption("SOLD");
    await page.getByRole("cell", { name: "Sold", exact: true }).waitFor();
    assert.equal(await page.locator("tbody tr").count(), 1);
    assert.equal(
      await page.getByRole("button", { name: "Disable", exact: true }).count(),
      0,
    );
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page
      .getByRole("button", { name: "Disable", exact: true })
      .first()
      .click();
    dialog = page.getByRole("dialog", { name: "Disable code", exact: true });
    await dialog.getByRole("button", { name: "Confirm disable" }).click();
    await dialog
      .getByRole("status")
      .filter({ hasText: "Code disabled" })
      .waitFor();
    await dialog.getByRole("button", { name: "Close Disable code" }).click();
    await page.goto(base + "/admin/purchases");
    await page.locator("tbody tr").first().waitFor();
    assert.equal(await page.locator("tbody tr").count(), 10);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText("Showing 11–12", { exact: true }).waitFor();
    await page
      .getByLabel("Purchase reference", { exact: true })
      .fill("missing-reference");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page
      .getByText("No matching records found.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await page.locator("tbody tr").first().waitFor();
    unavailable = true;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
    unavailable = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.locator("tbody tr").first().waitFor();
    await page.getByRole("button", { name: "Completed", exact: true }).click();
    await page
      .getByRole("button", { name: "ANK-test-0", exact: true })
      .filter({ visible: true })
      .click();
    dialog = page.getByRole("dialog", {
      name: "Purchase Details",
      exact: true,
    });
    await dialog
      .getByRole("heading", { name: "Payment attempts (3)" })
      .waitFor();
    assert.equal(await dialog.locator("article").count(), 3);
    await dialog
      .getByRole("button", { name: "Close Purchase Details" })
      .click();
    await page.goto(base + "/admin/payments");
    await page.locator(".recharts-area-curve").waitFor();
    await page.locator(".recharts-pie").waitFor();
    const volume = page.getByRole("region", { name: "Payment Volume" });
    await volume.getByRole("button", { name: "Weekly", exact: true }).click();
    await volume
      .getByText("28 Sep: ", { exact: false })
      .waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Successful", exact: true }).click();
    await page
      .getByRole("button", { name: "PAY-test-2", exact: true })
      .filter({ visible: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Payment Details", exact: true });
    await dialog.getByText("test@example.com", { exact: true }).waitFor();
    await page.screenshot({
      path: new URL("payments-desktop.png", artifacts).pathname.replace(
        /^\/(\w:)/,
        "$1",
      ),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.goto(base + "/admin");
    await page
      .getByRole("region", { name: "Sales Overview" })
      .locator(".recharts-area-curve")
      .waitFor();
    await page
      .getByRole("region", { name: "Package Sales" })
      .locator(".recharts-pie")
      .waitFor();
    await page.getByText("Total Purchases", { exact: true }).waitFor();
    await page.goto(base + "/admin/packages");
    await page.getByText("Average Price", { exact: true }).waitFor();
    await page
      .getByRole("heading", { name: "All Packages", exact: true })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["access-codes", "purchases", "payments"]) {
      await page.goto(`${base}/admin/${route}`);
      await page
        .getByRole("heading", {
          name:
            route === "access-codes"
              ? "Access Codes"
              : route === "purchases"
                ? "Purchases"
                : "Payments",
          exact: true,
        })
        .first()
        .waitFor();
      await pause(250);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        route + " overflow",
      );
    }
    await page.goto(base + "/admin/purchases");
    await page
      .getByRole("button", { name: "ANK-test-0", exact: true })
      .filter({ visible: true })
      .click();
    dialog = page.getByRole("dialog", {
      name: "Purchase Details",
      exact: true,
    });
    assert((await dialog.boundingBox()).width <= 390);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("dialog", { name: "Admin navigation", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    expired = true;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await page.waitForURL("**/admin/login");
    await context.close();
  }
  expired = true;
  const invalid = await call("payments?limit=11");
  assert.equal(invalid.status, 401);
  assert.match(invalid.headers.get("set-cookie"), /anka-admin-session=;/);
  assert(!(await invalid.text()).includes("private diagnostic"));
  console.log(
    "Admin operations smoke checks passed" +
      (browser
        ? " (including desktop/mobile browser flows)."
        : " (API and protected routes)."),
  );
} finally {
  await browser?.close();
  child.kill();
  await new Promise((resolve) => backend.close(resolve));
}
