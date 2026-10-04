import { NextRequest, NextResponse } from "next/server";
import {
  adminPackageSchema,
  packageFormSchema,
  recentPurchaseSchema,
} from "@/lib/schemas/admin-package";
import { z } from "zod";
import {
  accessCodeSchema,
  accessCodeListSchema,
  adminPurchaseSchema,
  adminPaymentSchema,
  addCodeSchema,
  bulkCodesSchema,
  bulkResultSchema,
  codeStatus,
  purchaseStatus,
  paymentStatus,
} from "@/lib/schemas/admin-operations";
const reply = (message: string, status: number) =>
  NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const route = path.join("/");
  const method = request.method;
  const listPackages = method === "GET" && route === "packages";
  const purchases = method === "GET" && route === "purchases";
  const listCodes = method === "GET" && route === "access-codes";
  const listPayments = method === "GET" && route === "payments";
  const detail =
    method === "GET" &&
    path.length === 2 &&
    ["purchases", "payments"].includes(path[0]) &&
    /^[A-Za-z0-9.=_-]{1,128}$/.test(path[1]);
  const addCode = method === "POST" && route === "access-codes";
  const bulk = method === "POST" && route === "access-codes/bulk";
  const disable =
    method === "POST" &&
    path.length === 3 &&
    path[0] === "access-codes" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(path[1]) &&
    path[2] === "disable";
  const create = method === "POST" && route === "packages";
  const update =
    method === "PATCH" &&
    path.length === 2 &&
    path[0] === "packages" &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(path[1]);
  if (
    !listPackages &&
    !purchases &&
    !create &&
    !update &&
    !listCodes &&
    !listPayments &&
    !detail &&
    !addCode &&
    !bulk &&
    !disable
  )
    return reply("Not found", 404);
  if (
    method !== "GET" &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return reply("Request not allowed", 403);
  const token = request.cookies.get("anka-admin-session")?.value;
  if (!token) return reply("Please sign in", 401);
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return reply("Admin service unavailable", 503);
  let body: string | undefined;
  let suffix = "";
  if (listPackages || purchases || listCodes || listPayments) {
    const params = request.nextUrl.searchParams;
    const limit =
      params.get("limit") ?? (listPackages ? "100" : purchases ? "5" : "50");
    const offset = params.get("offset") ?? "0";
    if (
      !/^\d{1,3}$/.test(limit) ||
      Number(limit) < 1 ||
      Number(limit) > 100 ||
      !/^\d{1,6}$/.test(offset) ||
      Number(offset) > 100000
    )
      return reply("Invalid page", 400);
    const query = new URLSearchParams({ limit, offset });
    const status = params.get("status");
    if (status) {
      const schema = listCodes
        ? codeStatus
        : purchases
          ? purchaseStatus
          : listPayments
            ? paymentStatus
            : z.enum(["ACTIVE", "INACTIVE"]);
      if (!schema.safeParse(status).success)
        return reply("Invalid status", 400);
      query.set("status", status);
    }
    const fields = listCodes
      ? { packageId: 64 }
      : purchases
        ? { reference: 128, phone: 16, customerId: 64 }
        : listPayments
          ? { purchaseReference: 128 }
          : {};
    for (const [key, max] of Object.entries(fields)) {
      const value = params.get(key);
      if (value) {
        if (value.length > max || /[\x00-\x1f]/.test(value))
          return reply("Invalid filter", 400);
        query.set(key, value);
      }
    }
    suffix = "?" + query.toString();
  } else if (detail || disable) {
    // Read-only details and the dedicated guarded disable transition have no body.
  } else if (addCode || bulk) {
    try {
      const parsed = (bulk ? bulkCodesSchema : addCodeSchema)
        .strict()
        .safeParse(await request.json());
      if (!parsed.success) return reply("Invalid access codes", 400);
      body = JSON.stringify(parsed.data);
    } catch {
      return reply("Invalid access codes", 400);
    }
  } else {
    try {
      const input = await request.json();
      const schema = update
        ? packageFormSchema.partial().extend({ price: z.string().optional() })
        : packageFormSchema;
      // Status-only PATCH is supported; full edits use the same validation as creation.
      const parsed =
        update && Object.keys(input).length === 1 && "status" in input
          ? z
              .object({ status: z.enum(["ACTIVE", "INACTIVE"]) })
              .strict()
              .safeParse(input)
          : schema.strict().safeParse(input);
      if (!parsed.success) return reply("Check the package details", 400);
      if ("price" in parsed.data && parsed.data.price !== undefined) {
        const price = packageFormSchema.shape.price.safeParse(
          parsed.data.price,
        );
        if (!price.success) return reply("Invalid price", 400);
      }
      body = JSON.stringify({
        ...parsed.data,
        ...("price" in parsed.data && parsed.data.price !== undefined
          ? { price: Number(parsed.data.price) }
          : {}),
      });
    } catch {
      return reply("Invalid package details", 400);
    }
  }
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/admin/${route}${suffix}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!upstream.ok) {
      const status = [400, 401, 403, 404, 409, 429].includes(upstream.status)
        ? upstream.status
        : 502;
      const response = reply("Admin request could not be completed", status);
      if (status === 401) response.cookies.delete("anka-admin-session");
      return response;
    }
    const raw: unknown = await upstream.json();
    const schema = listCodes
      ? z.array(accessCodeListSchema)
      : listPayments
        ? z.array(adminPaymentSchema)
        : purchases
          ? z.array(
              request.nextUrl.searchParams.has("limit")
                ? adminPurchaseSchema
                : recentPurchaseSchema,
            )
          : detail
            ? path[0] === "purchases"
              ? adminPurchaseSchema
              : adminPaymentSchema
            : bulk
              ? bulkResultSchema
              : addCode || disable
                ? accessCodeSchema
                : listPackages
                  ? z.array(adminPackageSchema)
                  : adminPackageSchema;
    const data = schema.parse(raw);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return reply("Admin service temporarily unavailable", 502);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
