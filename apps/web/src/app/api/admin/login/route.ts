import { NextRequest, NextResponse } from "next/server";
import {
  adminLoginSchema,
  adminLoginResponseSchema,
} from "@/lib/schemas/admin";

function reply(message: string, status: number) {
  return NextResponse.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply("Request not allowed", 403);
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) return reply("Login is temporarily unavailable", 503);
  let values;
  try {
    values = adminLoginSchema.safeParse(await request.json());
  } catch {
    return reply("Invalid login details", 400);
  }
  if (!values.success) return reply("Invalid login details", 400);
  try {
    const upstream = await fetch(
      `${base.replace(/\/$/, "")}/admin/auth/login`,
      {
        method: "POST",
        cache: "no-store",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values.data),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!upstream.ok) {
      const status = [400, 401, 429].includes(upstream.status)
        ? upstream.status
        : 502;
      return reply("Login could not be completed", status);
    }
    const parsed = adminLoginResponseSchema.safeParse(await upstream.json());
    if (!parsed.success) return reply("Login could not be completed", 502);
    const { admin, expiresIn, accessToken } = parsed.data;
    const response = NextResponse.json(
      { admin, expiresIn },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set("anka-admin-session", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: expiresIn,
    });
    return response;
  } catch {
    return reply("Login is temporarily unavailable", 502);
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply("Request not allowed", 403);
  const response = reply("Signed out", 200);
  response.cookies.set("anka-admin-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
