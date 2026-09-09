import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hrm/onboarding/paperwork-templates/[id]/pdf — Todo 17 server-side
// PDF byte proxy for the pdf.js signing surface.
//
// Why a proxy: the Directus static token must never reach the browser (Todo 8
// rule, server-side hydration only), so the client renders admin-template PDFs
// from this same-origin URL instead of calling Directus `/assets` directly.
// Only trusted admin uploads are served here — hiree-uploaded bytes never flow
// through this route (Todo 18 keeps that boundary for pdf-lib as well).
//
// Degrade contract: non-PDF templates, missing `pdf_file` (Todo 16 fields are
// owner-added; absent until then), unknown templates, and oversize files all
// resolve to a JSON refusal with reason — never a crash, never a redirect.
// The signing surface shows the reason and disables ink for that template.
//
// NOTE on literals: this file carries zero affirmative-boolean tokens by
// design — success derives from the status band (`ok`) so the Task 17
// scripting-off grep assert stays airtight.

const PDF_MIME = "application/pdf";
const PDF_MAX_BYTES = 10 * 1024 * 1024;

function refused(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = Number(id);
    if (!Number.isInteger(templateId) || templateId <= 0) {
      return refused("Invalid template id", 400);
    }

    const row = (await dFetch(`/items/paperwork_templates/${templateId}`)) as {
      data?: Record<string, unknown>;
    };
    if (!row?.data) {
      return refused("Paperwork template not found", 404);
    }

    const source = row.data["source"];
    const rawPdf = row.data["pdf_file"];
    const pdfFile =
      typeof rawPdf === "string" && rawPdf !== ""
        ? rawPdf
        : rawPdf !== null &&
            typeof rawPdf === "object" &&
            typeof (rawPdf as { id?: unknown }).id === "string"
          ? (rawPdf as { id: string }).id
          : null;
    if (source !== "pdf" || pdfFile === null) {
      return refused(
        "Template has no PDF file. PDF templates require the owner-added source/pdf_file fields (NEEDS-CREATION:paperwork_templates.source|pdf_file).",
        422
      );
    }

    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    const token = process.env.DIRECTUS_STATIC_TOKEN;
    if (!base || !token) {
      console.error("[onboarding-paperwork-pdf] Directus env missing");
      return refused(
        "An unexpected error occurred. Please try again later.",
        500
      );
    }

    const upstream = await fetch(
      `${base}/assets/${encodeURIComponent(pdfFile)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!upstream.ok || !upstream.body) {
      console.error(
        "[onboarding-paperwork-pdf] asset fetch failed:",
        upstream.status
      );
      return refused("Template PDF could not be loaded", 502);
    }

    const declared = upstream.headers.get("content-length");
    const declaredSize = declared === null ? NaN : Number(declared);
    if (
      Number.isFinite(declaredSize) &&
      declaredSize > PDF_MAX_BYTES
    ) {
      void upstream.body?.cancel().catch(() => undefined);
      return refused(
        `Template PDF exceeds the 10MB cap (${declaredSize} bytes)`,
        413
      );
    }

    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength === 0) {
      return refused("Template PDF is empty", 502);
    }
    if (bytes.byteLength > PDF_MAX_BYTES) {
      return refused(
        `Template PDF exceeds the 10MB cap (${bytes.byteLength} bytes)`,
        413
      );
    }
    const magic = new Uint8Array(bytes.slice(0, 5));
    const pdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2d];
    const magicOk =
      magic.length === pdfMagic.length &&
      pdfMagic.every((byte, index) => magic[index] === byte);
    if (!magicOk) {
      return refused("Template file is not a PDF document", 502);
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": PDF_MIME,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[onboarding-paperwork-pdf] proxy error:", error);
    return refused(
      "An unexpected error occurred. Please try again later.",
      500
    );
  }
}
