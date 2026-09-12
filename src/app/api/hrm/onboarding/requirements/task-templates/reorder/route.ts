import { NextRequest, NextResponse } from "next/server";

import { listTemplateRows } from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  REQUIREMENTS_ERROR_CODES,
  assertOrderEntriesExist,
  mapRequirementsFailure,
  readRequirementsSession,
  reorderTemplateRows,
  requirementsConflict,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import {
  RequirementsReorderBodySchema,
  isManagedTemplatePhase,
} from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hrm/onboarding/requirements/task-templates/reorder — the PINNED
// reorder contract `{ order: [{ id, sort_order }] }` applied as one sequence;
// returns the full managed catalog (documents / training / equipment) in its
// new order. Orientation-phase templates cannot be reordered here.

export async function PATCH(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = RequirementsReorderBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await listTemplateRows();
    const byId = new Map(current.map((row) => [row.id, row]));
    assertOrderEntriesExist(new Set(byId.keys()), validation.data.order);

    const derived = validation.data.order.filter(
      (entry) => byId.get(entry.id)?.phase === "orientation"
    );
    if (derived.length > 0) {
      return requirementsConflict(
        REQUIREMENTS_ERROR_CODES.derivedRow,
        "Orientation-phase templates are derived from the orientation topic catalog and cannot be reordered here."
      );
    }

    await reorderTemplateRows(validation.data.order, session.actorId);
    const rows = (await listTemplateRows()).filter((row) =>
      isManagedTemplatePhase(row.phase)
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[requirements-task-templates] reorder error:", error);
    return mapRequirementsFailure(error);
  }
}
