import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

export async function checkAdminBrowser(base, credentials) {
  const artifacts = resolve(".next/admin-smoke/browser");
  await mkdir(artifacts, { recursive: true });
  const browser = spawn(
    process.env.ANKA_BROWSER_PATH ??
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      "--user-data-dir=" + resolve(".next/admin-smoke/browser-profile"),
      "about:blank",
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  let socket;
  try {
    let stderr = "";
    const endpoint = await new Promise((resolveEndpoint, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Browser did not start")),
        30000,
      );
      browser.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      browser.stderr.on("data", (chunk) => {
        stderr += chunk;
        const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
        if (match) {
          clearTimeout(timer);
          resolveEndpoint(match[1]);
        }
      });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolveOpen, reject) => {
      socket.onopen = resolveOpen;
      socket.onerror = reject;
    });
    let sequence = 0;
    const pending = new Map();
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const waiter = pending.get(message.id);
        if (!waiter) return;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      }
    };
    function send(method, params = {}, sessionId) {
      return new Promise((resolveCall, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve: resolveCall, reject });
        socket.send(
          JSON.stringify({
            id,
            method,
            params,
            ...(sessionId ? { sessionId } : {}),
          }),
        );
      });
    }
    const { targetId } = await send("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const page = (method, params) => send(method, params, sessionId);
    await page("Page.enable");
    await page("Runtime.enable");
    async function evaluate(expression) {
      const result = await page("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }
    async function until(expression, label) {
      for (let i = 0; i < 240; i++) {
        if (await evaluate(expression)) return;
        await pause(250);
      }
      throw new Error(
        "Timed out waiting for " +
          label +
          ": " +
          (await evaluate("document.body.innerText.slice(0,1000)")),
      );
    }
    async function screenshot(name) {
      const result = await page("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(
        resolve(artifacts, name + ".png"),
        Buffer.from(result.data, "base64"),
      );
    }
    async function viewport(width, height, mobile = false) {
      await page("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
    }
    async function fill(name, value, selector = "input") {
      await evaluate(
        `(() => { const e = document.querySelector('${selector}[name="${name}"]'); e.focus(); e.select(); })()`,
      );
      await page("Input.insertText", { text: value });
    }
    await viewport(1536, 1024);
    await page("Page.navigate", { url: base + "/admin/login" });
    await until(
      "Boolean(document.querySelector('#admin-email'))",
      "login form",
    );
    await until(
      "Object.keys(document.querySelector('#admin-email')).some(key => key.startsWith('__reactProps'))",
      "login hydration",
    );
    await fill("email", credentials.email.trim());
    await fill("password", credentials.password);
    await evaluate("document.querySelector('button[type=submit]').click()");
    await until(
      "location.pathname === '/admin' && document.body.innerText.includes('Welcome back')",
      "successful login navigation",
    );
    assert(
      await evaluate(
        "document.body.innerText.includes('Sales Overview') && document.body.innerText.includes('Payment Volume') && document.body.innerText.includes('Payment Status') && document.body.innerText.includes('Package Sales')",
      ),
    );
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      "Desktop dashboard overflow",
    );
    await screenshot("dashboard-desktop");
    await page("Page.navigate", { url: base + "/admin/packages" });
    await until(
      "document.body.innerText.includes('Edited test plan')",
      "package list",
    );
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      "Desktop packages overflow",
    );
    await screenshot("packages-desktop");
    // Create through RHF and verify cache invalidation updates the visible package list.
    await fill("name", "Browser-created test plan");
    await fill("price", "987.65");
    await fill("description", "Browser smoke fixture", "textarea");
    await evaluate("document.querySelector('button[type=submit]').click()");
    await until(
      "document.body.innerText.includes('Package created successfully.') && document.body.innerText.includes('Browser-created test plan')",
      "create and query invalidation",
    );
    await viewport(390, 844, true);
    await pause(500);
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      "Mobile packages overflow",
    );
    await screenshot("packages-mobile");
    await evaluate(
      "document.querySelector('[aria-label=\"Open navigation\"]').click()",
    );
    assert(
      await evaluate(
        "document.querySelector('dialog[aria-label=\"Admin navigation\"]').open",
      ),
      "Mobile sidebar drawer",
    );
    await evaluate(
      "document.querySelector('[aria-label=\"Close navigation\"]').click()",
    );
    await evaluate(
      "Array.from(document.querySelectorAll('button')).find(e => e.innerText === 'Add Package').click()",
    );
    assert(
      await evaluate(
        "document.querySelector('dialog[aria-labelledby=\"package-dialog-title\"]').open",
      ),
      "Mobile form dialog",
    );
    await screenshot("package-form-mobile");
    await evaluate(
      "document.querySelector('[aria-label=\"Close package form\"]').click()",
    );
    await page("Page.navigate", { url: base + "/admin" });
    await until(
      "document.body.innerText.includes('Welcome back')",
      "mobile dashboard",
    );
    assert(
      await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"),
      "Mobile dashboard overflow",
    );
    await screenshot("dashboard-mobile");
    // Open drawer and use the real logout mutation, then verify route protection.
    await evaluate(
      "document.querySelector('[aria-label=\"Open navigation\"]').click()",
    );
    await evaluate(
      "document.querySelector('dialog [aria-label=\"Logout\"]').click()",
    );
    await until("location.pathname === '/admin/login'", "logout redirect");
    assert(
      !(await evaluate("document.cookie")).includes("anka-admin-session"),
      "Session token must remain HttpOnly",
    );
    await page("Page.navigate", { url: base + "/admin/packages" });
    await until(
      "location.pathname === '/admin/login'",
      "logged-out route protection",
    );
    console.log(
      "PASS: browser login/logout, Recharts empty states, package form creation/cache invalidation, desktop/mobile overflow, mobile drawer and form dialog.",
    );
    console.log("Screenshots: " + artifacts);
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 999999, method: "Browser.close" }));
      socket.close();
    }
    browser.kill();
  }
}
