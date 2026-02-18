import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const UPSTREAM_BASE = process.env.SPRING_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;

function buildUpstreamUrl(req: NextRequest, pathParts: string[]) {
  const upstream = (UPSTREAM_BASE || "").replace(/\/+$/, "");
  const path = pathParts.map(encodeURIComponent).join("/");
  const url = new URL(`${upstream}/${path}`);

  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));
  return url;
}

function withCors(res: NextResponse, req: NextRequest) {
  const origin = req.headers.get("origin") || "*";
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

function pickForwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);

  return headers;
}

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;

  if (!UPSTREAM_BASE) {
    const res = NextResponse.json({ error: "UPSTREAM_API_BASE_URL (or similar) is not set" }, { status: 500 });
    return withCors(res, req);
  }

  const upstreamUrl = buildUpstreamUrl(req, path);
  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let body: BodyInit | undefined = undefined;
  if (hasBody) body = await req.arrayBuffer();

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method,
    headers: pickForwardHeaders(req),
    body,
    redirect: "manual",
  });

  const contentType = upstreamRes.headers.get("content-type") || "application/json";
  const raw = await upstreamRes.arrayBuffer();

  const res = new NextResponse(raw, { status: upstreamRes.status, headers: { "content-type": contentType } });
  return withCors(res, req);
}

export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  return withCors(res, req);
}

export async function GET(req: NextRequest, context: any) { return proxy(req, context); }
export async function POST(req: NextRequest, context: any) { return proxy(req, context); }
export async function PUT(req: NextRequest, context: any) { return proxy(req, context); }
export async function PATCH(req: NextRequest, context: any) { return proxy(req, context); }
export async function DELETE(req: NextRequest, context: any) { return proxy(req, context); }
