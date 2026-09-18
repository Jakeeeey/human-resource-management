import { NextRequest, NextResponse } from "next/server";

import {
  listEquipmentItemRows,
  reorderEquipmentItems,
} from "@/modules/human-resource-management/onboarding/equipment/server/equipmentItemIo";
import {
  assertOrderEntriesExist,
  mapRequirementsFailure,
  readRequirementsSession,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { RequirementsReorderBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/hrm/onboarding/requirements/equipment/reorder — the PINNED
// reorder contract `{ order: [{ id, sort_order }] }` applied as one sequence;
// returns the full catalog in its new order.

export async function PATCH(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = RequirementsReorderBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await listEquipmentItemRows();
    assertOrderEntriesExist(
      new Set(current.map((row) => row.id)),
      validation.data.order
    );

    await reorderEquipmentItems(validation.data.order, session.actorId);
    return NextResponse.json({
      success: true,
      data: await listEquipmentItemRows(),
    });
  } catch (error) {
    console.error("[requirements-equipment] reorder error:", error);
    return mapRequirementsFailure(error);
  }
}
