import { NextRequest } from "next/server";
async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const endpoint = path.join("/");
  const allowed =
    request.method === "GET"
      ? endpoint === "packages" ||
        /^payments\/verify\/[A-Za-z0-9.=-]{1,128}$/.test(endpoint)
      : endpoint === "purchases" || endpoint === "payments/initialize";
  if (!allowed) return Response.json({ message: "Not found" }, { status: 404 });
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base)
    return Response.json({ message: "Service unavailable" }, { status: 503 });
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/${endpoint}`, {
      method: request.method,
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: request.method === "POST" ? await request.text() : undefined,
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      // Project only recovery fields, never provider errors or customer data.
      const detail: unknown = await response.json().catch(() => null);
      const recovery: { paymentReference?: string; paymentState?: string } = {};
      if (typeof detail === "object" && detail !== null) {
        if (
          endpoint === "payments/initialize" &&
          [409, 502].includes(response.status) &&
          "paymentReference" in detail &&
          typeof detail.paymentReference === "string" &&
          /^[A-Za-z0-9.=-]{1,128}$/.test(detail.paymentReference)
        )
          recovery.paymentReference = detail.paymentReference;
        if (
          endpoint.startsWith("payments/verify/") &&
          response.status === 400 &&
          "paymentState" in detail &&
          ["PENDING", "FAILED"].includes(String(detail.paymentState))
        )
          recovery.paymentState = String(detail.paymentState);
      }
      return Response.json(
        { message: "Request could not be completed", ...recovery },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ message: "Service unavailable" }, { status: 502 });
  }
}
export const GET = forward;
export const POST = forward;
