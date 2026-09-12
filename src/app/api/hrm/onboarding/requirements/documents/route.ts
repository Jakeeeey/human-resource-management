import { NextRequest, NextResponse } from "next/server";

import {
  createDocSlotRows,
  listDocSlotRows,
  type DocSlotWriteRow,
} from "@/modules/human-resource-management/employee-portal/server/documentSlotIo";
import {
  mapRequirementsFailure,
  nextSortOrder,
  phTimeNow,
  readAllFlag,
  readRequirementsSession,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { CreateDocumentSlotBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/requirements/documents — document-slot catalog,
//      `sort_order` order. Default: active only; `?all=1` includes deactivated.
// POST /api/hrm/onboarding/requirements/documents — create a slot (`.strict()`
//      body; `doc_key` immutable after create). No role gate — the session
//      supplies the audit actor only.

export async function GET(req: NextRequest) {
  try {
    if (!readRequirementsSession(req).ok) return unauthorized();
    const rows = await listDocSlotRows({ activeOnly: !readAllFlag(req) });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[requirements-documents] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateDocumentSlotBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await listDocSlotRows();
    const now = phTimeNow();
    const write: DocSlotWriteRow = {
      doc_key: validation.data.doc_key,
      title: validation.data.title,
      is_required: validation.data.is_required ?? true,
      sort_order: validation.data.sort_order ?? nextSortOrder(current),
      is_active: true,
      created_at: now,
      created_by: session.actorId,
      updated_at: now,
      updated_by: session.actorId,
    };
    const created = await createDocSlotRows([write]);
    return NextResponse.json(
      { success: true, data: created[0] ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[requirements-documents] create error:", error);
    return mapRequirementsFailure(error);
  }
}
