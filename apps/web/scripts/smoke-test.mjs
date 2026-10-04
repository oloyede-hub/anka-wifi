import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";

// Runs the real production frontend against an isolated mock API, without Paystack charges.
const requests = [];
let mode = "ready";
let adminMode = "ready";
let packages = [];
let mutationFailure = false;
const backend = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  requests.push({ path: req.url, method: req.method, body });
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/admin/") && req.url !== "/admin/auth/login") {
    if (
      req.headers.authorization !== "Bearer header.payload.signature" ||
      adminMode === "unauthorized"
    ) {
      res.writeHead(401);
      res.end(JSON.stringify({ message: "internal auth diagnostic" }));
      return;
    }
    if (mutationFailure) {
      res.writeHead(500);
      res.end(JSON.stringify({ message: "internal database diagnostic" }));
      return;
    }
    if (req.url === "/admin/auth/me") {
      res.end(
        JSON.stringify({
          id: "staff-id",
          email: "staff@example.com",
          name: "Anka Staff",
        }),
      );
      return;
    }
    if (req.url.startsWith("/admin/packages")) {
      if (req.method === "POST") {
        packages.push({
          id: packages.length
            ? "test-created-plan-" + packages.length
            : "test-created-plan",
          ...JSON.parse(body),
          price: String(JSON.parse(body).price),
          featured: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        res.end(JSON.stringify(packages.at(-1)));
        return;
      }
      if (req.method === "PATCH") {
        const update = JSON.parse(body);
        packages[0] = {
          ...packages[0],
          ...update,
          ...(update.price !== undefined
            ? { price: String(update.price) }
            : {}),
        };
        res.end(JSON.stringify(packages[0]));
        return;
      }
      res.end(JSON.stringify(packages));
      return;
    }
    if (req.url.startsWith("/admin/purchases")) {
      res.end(JSON.stringify([]));
      return;
    }
  }
  if (mode === "error") {
    res.writeHead(503);
    res.end(JSON.stringify({ secret: "internal diagnostic" }));
    return;
  }
  if (req.url === "/admin/auth/login" && adminMode === "unauthorized") {
    res.writeHead(401);
    res.end(JSON.stringify({ message: "internal auth diagnostic" }));
    return;
  }
  if (req.url === "/admin/auth/login" && adminMode === "rate-limit") {
    res.writeHead(429);
    res.end("{}");
    return;
  }
  const results = {
    "/admin/auth/login": {
      accessToken:
        adminMode === "malformed" ? "invalid" : "header.payload.signature",
      tokenType: "Bearer",
      expiresIn: 3600,
      admin: { id: "staff-id", email: "staff@example.com", name: "Anka Staff" },
    },
    "/packages":
      mode === "empty"
        ? []
        : [
            {
              id: "test-plan",
              name: "Test Plan",
              type: "WEEKLY",
              price: "1234.50",
              status: "ACTIVE",
              featured: true,
            },
          ],
    "/purchases": { reference: "ANK-random-test" },
    "/payments/initialize": {
      purchaseReference: "ANK-random-test",
      paymentReference: "PAY-random-test",
      authorizationUrl: "https://checkout.paystack.com/test",
    },
    "/payments/verify/PAY-random-test": {
      payment: { reference: "PAY-random-test", status: "SUCCESSFUL" },
      purchase: {
        reference: "ANK-random-test",
        status: "COMPLETED",
        package: "Test Plan",
      },
      accessCode: "TEST-CODE",
    },
  };
  res.end(JSON.stringify(results[req.url] ?? {}));
});
await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
const frontend = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    process.env.ANKA_SMOKE_DEV === "1" ? "dev" : "start",
    "-p",
    "4317",
  ],
  {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backend.address().port}`,
      ...(process.env.ANKA_SMOKE_DEV === "1"
        ? { ANKA_WEB_DIST_DIR: ".next/admin-smoke" }
        : {}),
    },
    stdio: "pipe",
  },
);
let output = "";
frontend.stdout.on("data", (chunk) => {
  output += chunk;
});
frontend.stderr.on("data", (chunk) => {
  output += chunk;
});
const base = "http://localhost:4317";
try {
  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for startup. */
    }
    await pause(500);
  }
  assert(ready, output);
  for (const path of [
    "/",
    "/admin/login",
    "/payment/check",
    "/payment/callback?reference=PAY-random-test",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Anka WiFi/);
  }
  const call = (path, body) =>
    fetch(
      `${base}/api/customer/${path}`,
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : undefined,
    );
  assert.equal((await (await call("packages")).json())[0].price, "1234.50");
  mode = "empty";
  assert.deepEqual(await (await call("packages")).json(), []);
  mode = "error";
  const failure = await call("packages");
  assert.equal(failure.status, 503);
  assert(!JSON.stringify(await failure.json()).includes("internal diagnostic"));
  mode = "ready";
  const customer = {
    packageId: "test-plan",
    phone: "+2348012345678",
    email: "test@example.com",
  };
  assert.equal(
    (await (await call("purchases", customer)).json()).reference,
    "ANK-random-test",
  );
  assert.deepEqual(JSON.parse(requests.at(-1).body), customer);
  assert.equal(
    (
      await (
        await call("payments/initialize", {
          purchaseReference: "ANK-random-test",
        })
      ).json()
    ).authorizationUrl,
    "https://checkout.paystack.com/test",
  );
  const verified = await call("payments/verify/PAY-random-test");
  assert.equal(verified.headers.get("cache-control"), "no-store");
  assert.equal((await verified.json()).accessCode, "TEST-CODE");
  const count = requests.length;
  assert.equal((await call("purchases/ANK-random-test")).status, 404);
  assert.equal((await call("admin")).status, 404);
  assert.equal(requests.length, count);
  const auth = (body, origin = base, method = "POST") =>
    fetch(`${base}/api/admin/login`, {
      method,
      headers: { "Content-Type": "application/json", Origin: origin },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
  const credentials = {
    email: " STAFF@example.com ",
    password: "test password",
  };
  const authenticated = await auth({ ...credentials, extra: "stripped" });
  assert.equal(authenticated.status, 200);
  const loginResult = await authenticated.json();
  assert.equal(loginResult.admin.name, "Anka Staff");
  assert(!("accessToken" in loginResult));
  assert.deepEqual(JSON.parse(requests.at(-1).body), {
    email: "staff@example.com",
    password: "test password",
  });
  const cookie = authenticated.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  if (process.env.ANKA_SMOKE_DEV !== "1") assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=strict/i);
  assert.match(cookie, /Max-Age=3600/i);
  assert.equal(authenticated.headers.get("cache-control"), "no-store");
  const sessionCookie = cookie.split(";")[0];
  const manage = (
    path,
    method = "GET",
    data,
    cookieValue = sessionCookie,
    origin = base,
  ) =>
    fetch(base + "/api/admin/" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        ...(cookieValue ? { Cookie: cookieValue } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  for (const path of ["/admin", "/admin/packages"]) {
    const unauthenticated = await fetch(base + path, { redirect: "manual" });
    assert.equal(unauthenticated.status, 307);
    assert.equal(unauthenticated.headers.get("location"), "/admin/login");
    const protectedPage = await fetch(base + path, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(protectedPage.status, 200);
    assert.match(await protectedPage.text(), /Anka Staff/);
  }
  const alreadyAuthenticated = await fetch(base + "/admin/login", {
    headers: { Cookie: sessionCookie },
    redirect: "manual",
  });
  assert.equal(alreadyAuthenticated.status, 307);
  assert.equal(alreadyAuthenticated.headers.get("location"), "/admin");
  assert.equal((await manage("packages", "GET", undefined, "")).status, 401);
  assert.deepEqual(await (await manage("packages")).json(), []);
  const newPackage = {
    name: "Smoke test plan",
    type: "DAILY",
    price: "1234.50",
    status: "ACTIVE",
    description: "Isolated test fixture",
  };
  assert.equal((await manage("packages", "POST", newPackage)).status, 200);
  assert.equal(JSON.parse(requests.at(-1).body).price, 1234.5);
  assert.equal(
    (await (await manage("packages")).json())[0].name,
    newPackage.name,
  );
  assert.equal(
    (
      await manage("packages/test-created-plan", "PATCH", {
        ...newPackage,
        name: "Edited test plan",
      })
    ).status,
    200,
  );
  for (const status of ["INACTIVE", "ACTIVE"]) {
    const response = await manage("packages/test-created-plan", "PATCH", {
      status,
    });
    assert.equal((await response.json()).status, status);
  }
  const beforeInvalid = requests.length;
  assert.equal(
    (await manage("packages", "POST", { ...newPackage, price: "0.001" }))
      .status,
    400,
  );
  assert.equal(
    (await manage("packages", "POST", { ...newPackage, createdAt: "injected" }))
      .status,
    400,
  );
  assert.equal(
    (
      await manage(
        "packages",
        "POST",
        newPackage,
        sessionCookie,
        "https://other.example.com",
      )
    ).status,
    403,
  );
  assert.equal((await manage("packages?offset=-1")).status, 400);
  assert.equal((await manage("unsupported-resource")).status, 404);
  assert.equal(requests.length, beforeInvalid);
  assert.deepEqual(await (await manage("purchases")).json(), []);
  mutationFailure = true;
  const failedMutation = await manage("packages/test-created-plan", "PATCH", {
    status: "INACTIVE",
  });
  assert.equal(failedMutation.status, 502);
  assert(!(await failedMutation.text()).includes("diagnostic"));
  mutationFailure = false;
  if (process.env.ANKA_SMOKE_BROWSER === "1") {
    const { checkAdminBrowser } = await import("./admin-browser-check.mjs");
    await checkAdminBrowser(base, credentials);
  }
  console.log(
    "PASS: protected admin pages, authenticated login redirect, live package proxy, create/edit/status changes, validation, origin checks and private response projections.",
  );
  const beforeRejected = requests.length;
  assert.equal(
    (await auth(credentials, "https://other.example.com")).status,
    403,
  );
  assert.equal((await auth({ email: "invalid", password: "" })).status, 400);
  assert.equal(requests.length, beforeRejected);
  adminMode = "unauthorized";
  const rejected = await auth(credentials);
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.get("set-cookie"), null);
  assert(!(await rejected.text()).includes("diagnostic"));
  adminMode = "rate-limit";
  assert.equal((await auth(credentials)).status, 429);
  adminMode = "malformed";
  assert.equal((await auth(credentials)).status, 502);
  const signedOut = await auth(undefined, base, "DELETE");
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers.get("set-cookie"), /Max-Age=0/i);
  console.log(
    "PASS: admin credentials, token isolation, cookie security/expiry, origin check, invalid login, throttling and logout.",
  );
  console.log(
    "PASS: pages, package ready/empty/error contracts, purchase payload, initialization, verification, no-store, endpoint allowlist.",
  );
} finally {
  frontend.kill();
  backend.close();
}
