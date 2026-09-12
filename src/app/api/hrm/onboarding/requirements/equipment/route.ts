import { NextRequest, NextResponse } from "next/server";

import {
  createEquipmentItemRows,
  listEquipmentItemRows,
  type EquipmentItemWriteRow,
} from "@/modules/human-resource-management/onboarding/equipment/server/equipmentItemIo";
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
import { CreateEquipmentItemBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/requirements/equipment — equipment-item catalog,
//      `sort_order` order. Default: active only; `?all=1` includes deactivated.
// POST /api/hrm/onboarding/requirements/equipment — create an item (`.strict()`
//      body; `item_key` immutable after create). No role gate — the session
//      supplies the audit actor only.

export async function GET(req: NextRequest) {
  try {
    if (!readRequirementsSession(req).ok) return unauthorized();
    const rows = await listEquipmentItemRows({ activeOnly: !readAllFlag(req) });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[requirements-equipment] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateEquipmentItemBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await listEquipmentItemRows();
    const now = phTimeNow();
    const write: EquipmentItemWriteRow = {
      item_key: validation.data.item_key,
      label: validation.data.label,
      issuer: validation.data.issuer,
      is_required: validation.data.is_required ?? true,
      sort_order: validation.data.sort_order ?? nextSortOrder(current),
      is_active: true,
      created_at: now,
      created_by: session.actorId,
      updated_at: now,
      updated_by: session.actorId,
    };
    const created = await createEquipmentItemRows([write]);
    return NextResponse.json(
      { success: true, data: created[0] ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[requirements-equipment] create error:", error);
    return mapRequirementsFailure(error);
  }
}
