import { NextRequest, NextResponse } from "next/server";

import {
  listDocSlotRows,
  patchDocSlotRow,
  phTimeNow,
  softDeleteDocSlotRow,
} from "@/modules/human-resource-management/employee-portal/server/documentSlotIo";
import {
  hardDeleteItem,
  invalidId,
  mapRequirementsFailure,
  readRequirementsSession,
  requirementsNotFound,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { UpdateDocumentSlotBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH  /api/hrm/onboarding/requirements/documents/[id] — partial update
//        (title / is_required / is_active / sort_order).
// DELETE .../[id] — SOFT delete (`is_active=0`); the row stays readable.
//        `?hard=1` requests a true DELETE after the task-reference guard
//        (document slots carry no `onboarding_task` FK, so the guard passes).

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id === null) return invalidId();

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdateDocumentSlotBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = (await listDocSlotRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Document slot not found");

    const patch: Record<string, unknown> = {};
    if (validation.data.title !== undefined) patch.title = validation.data.title;
    if (validation.data.is_required !== undefined) {
      patch.is_required = validation.data.is_required;
    }
    if (validation.data.is_active !== undefined) {
      patch.is_active = validation.data.is_active;
    }
    if (validation.data.sort_order !== undefined) {
      patch.sort_order = validation.data.sort_order;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, data: current });
    }
    patch.updated_at = phTimeNow();
    patch.updated_by = session.actorId;

    const updated = await patchDocSlotRow(id, patch);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[requirements-documents] update error:", error);
    return mapRequirementsFailure(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id === null) return invalidId();

    const current = (await listDocSlotRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Document slot not found");

    if (req.nextUrl.searchParams.get("hard") === "1") {
      await hardDeleteItem("onboarding_document_slot", id);
      return NextResponse.json({ success: true, data: { id, deleted: true } });
    }

    const soft = await softDeleteDocSlotRow(id, session.actorId);
    return NextResponse.json({ success: true, data: soft });
  } catch (error) {
    console.error("[requirements-documents] delete error:", error);
    return mapRequirementsFailure(error);
  }
}
