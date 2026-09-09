import { NextRequest, NextResponse } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  LinkPortalDocumentSchema,
  assertHireeScope,
  portalFileMarker,
  readHireeScope,
} from "@/modules/human-resource-management/employee-portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hrm/onboarding/portal/documents — links an already-uploaded
// (application-form canon) file UUID to one checklist slot of the hiree's
// OWN hire record. Write order: canon upload → persist returned `data.id`
// → link here (never link before UUID). The route verifies the file exists
// in Directus, then stamps the portal marker so the checklist GET flips to
// filed. Access matrix: role=hr → 403; cross-hire profile_id → 403.

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = LinkPortalDocumentSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const scope = assertHireeScope(
      readHireeScope(req.headers, validation.data.profile_id)
    );
    if (!scope.ok) {
      return NextResponse.json(
        { success: false, message: scope.message },
        { status: scope.status }
      );
    }

    const { profile_id, doc_key, file_id } = validation.data;

    // The UUID must already exist (canon upload first — never link blind).
    let existing: { data?: unknown } | null = null;
    try {
      existing = (await dFetch(`/files/${encodeURIComponent(file_id)}?fields=id`)) as {
        data?: unknown;
      };
    } catch {
      existing = null;
    }
    if (!existing?.data) {
      return NextResponse.json(
        { success: false, message: "Uploaded file not found — upload first, then link" },
        { status: 404 }
      );
    }

    await dFetch(`/files/${encodeURIComponent(file_id)}`, {
      method: "PATCH",
      body: JSON.stringify({ description: portalFileMarker(profile_id, doc_key) }),
    });

    return NextResponse.json(
      {
        success: true,
        data: { profile_id, doc_key, file_id },
        message: "Document filed — checklist updated",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[onboarding-portal] documents error:", error);
    return NextResponse.json(
      { success: false, message: "An unexpected error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
