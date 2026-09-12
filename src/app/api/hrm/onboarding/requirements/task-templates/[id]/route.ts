import { NextRequest, NextResponse } from "next/server";

import {
  listTemplateRows,
  patchTemplateRow,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  REQUIREMENTS_ERROR_CODES,
  assertTemplateNotReferenced,
  hardDeleteItem,
  invalidId,
  mapRequirementsFailure,
  phTimeNow,
  readRequirementsSession,
  requirementsConflict,
  requirementsNotFound,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { UpdateTaskTemplateBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH  /api/hrm/onboarding/requirements/task-templates/[id] — partial update
//        (title / phase / owner_role / is_required / is_active / sort_order).
//        Orientation-phase rows are refused: they are derived from the topic
//        catalog (edit the topic instead).
// DELETE .../[id] — SOFT delete (`is_active=0`). `?hard=1` requests a true
//        DELETE; a template referenced by a task answers the coded 409.

const DERIVED_ROW_MESSAGE =
  "Orientation-phase templates are derived from the orientation topic catalog — edit the topic instead.";

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
    const validation = UpdateTaskTemplateBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = (await listTemplateRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Task template not found");
    if (current.phase === "orientation") {
      return requirementsConflict(
        REQUIREMENTS_ERROR_CODES.derivedRow,
        DERIVED_ROW_MESSAGE
      );
    }

    const patch: Record<string, unknown> = {};
    if (validation.data.title !== undefined) patch.title = validation.data.title;
    if (validation.data.phase !== undefined) patch.phase = validation.data.phase;
    if (validation.data.owner_role !== undefined) {
      patch.owner_role = validation.data.owner_role;
    }
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

    const updated = await patchTemplateRow(id, patch);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[requirements-task-templates] update error:", error);
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

    const current = (await listTemplateRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Task template not found");
    if (current.phase === "orientation") {
      return requirementsConflict(
        REQUIREMENTS_ERROR_CODES.derivedRow,
        DERIVED_ROW_MESSAGE
      );
    }

    if (req.nextUrl.searchParams.get("hard") === "1") {
      await assertTemplateNotReferenced(id);
      await hardDeleteItem("onboarding_task_template", id);
      return NextResponse.json({ success: true, data: { id, deleted: true } });
    }

    const soft = await patchTemplateRow(id, {
      is_active: 0,
      updated_at: phTimeNow(),
      updated_by: session.actorId,
    });
    return NextResponse.json({ success: true, data: soft });
  } catch (error) {
    console.error("[requirements-task-templates] delete error:", error);
    return mapRequirementsFailure(error);
  }
}
