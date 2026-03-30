import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { directusFetchRaw } from "../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRow = Record<string, string | number | null | undefined | boolean>;

function parseNullableNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredId(raw: unknown, label: string): number {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${label}: "${String(raw)}"`);
  return n;
}

function safeExtFromName(name: string) {
  const ext = path.extname(name || "").toLowerCase();
  const ok = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"]);
  return ok.has(ext) ? ext : "";
}

function randomId(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function saveBufferToPublicUploads(args: {
  salesmanId: number;
  qrTypeId: number | null;
  originalName: string;
  buffer: Buffer;
}): Promise<string> {
  const { salesmanId, qrTypeId, originalName, buffer } = args;

  const ext = safeExtFromName(originalName) || ".bin";
  const typePart = qrTypeId === null ? "none" : String(qrTypeId);

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "salesman-qr");
  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `salesman_${salesmanId}_type_${typePart}_${randomId()}${ext}`;
  const outPath = path.join(uploadsDir, filename);

  await fs.writeFile(outPath, buffer);

  return `/uploads/salesman-qr/${filename}`;
}

function safeJsonParse(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function directusJsonOrThrow(pathname: string, init?: RequestInit) {
  const r = await directusFetchRaw(pathname, init);
  const json = safeJsonParse(r.text);

  if (!r.ok) {
    const msg =
      json?.errors?.[0]?.message ||
      json?.message ||
      json?.error ||
      r.text ||
      `Directus error (${r.status})`;

    throw Object.assign(new Error(msg), {
      _directus: { status: r.status, body: r.text },
    });
  }

  return json;
}

/**
 * ✅ Next.js 16.1.6: ctx.params may be a Promise
 */
type RouteContext = { params: Promise<{ id: string }> };

async function getSalesmanIdFromCtx(ctx: RouteContext): Promise<number> {
  const params = await ctx.params;
  return parseRequiredId(params?.id, "salesman id");
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const salesmanId = await getSalesmanIdFromCtx(ctx);

    // ✅ NO Directus filters (avoid Directus filter issues)
    const json = await directusJsonOrThrow(`/items/salesman_qr_code?limit=-1`);
    const all: AnyRow[] = json?.data ?? [];
    const rows = all.filter((r) => Number(r.salesman_id) === salesmanId);

    return NextResponse.json({ data: rows });
  } catch (e) {
    const err = e as Error & { _directus?: unknown };
    return NextResponse.json(
      { message: err.message ?? "Failed to load QR codes.", directus: err._directus },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const salesmanId = await getSalesmanIdFromCtx(ctx);

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ message: "Expected multipart/form-data." }, { status: 400 });
    }

    const form = await req.formData();
    const qrTypeId = parseNullableNumber(form.get("qr_payment_type_id"));

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Missing uploaded file (field name: file)." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5MB guard
    const maxBytes = 5 * 1024 * 1024;
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json({ message: "File too large (max 5MB)." }, { status: 400 });
    }

    // 1) save locally
    const link = await saveBufferToPublicUploads({
      salesmanId,
      qrTypeId,
      originalName: file.name || "upload.bin",
      buffer,
    });

    // 2) load all rows and match in Node (no Directus filters)
    const allJson = await directusJsonOrThrow(`/items/salesman_qr_code?limit=-1`);
    const all: AnyRow[] = allJson?.data ?? [];

    const found =
      all.find((r) => {
        if (Number(r.salesman_id) !== salesmanId) return false;

        const t = r.qr_payment_type_id;
        const tNorm = t === null || t === undefined ? null : Number(t);
        const qNorm = qrTypeId === null ? null : Number(qrTypeId);
        return tNorm === qNorm;
      }) ?? null;

    // 3) upsert
    if (found?.id) {
      const upd = await directusJsonOrThrow(`/items/salesman_qr_code/${found.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          salesman_id: salesmanId,
          qr_payment_type_id: qrTypeId,
          link,
        }),
      });

      return NextResponse.json({ data: upd?.data ?? upd });
    }

    const created = await directusJsonOrThrow(`/items/salesman_qr_code`, {
      method: "POST",
      body: JSON.stringify({
        salesman_id: salesmanId,
        qr_payment_type_id: qrTypeId,
        link,
      }),
    });

    return NextResponse.json({ data: created?.data ?? created });
  } catch (e) {
    const err = e as Error & { _directus?: unknown };
    return NextResponse.json(
      { message: err.message ?? "Failed to save QR code.", directus: err._directus },
      { status: 500 },
    );
  }
}
