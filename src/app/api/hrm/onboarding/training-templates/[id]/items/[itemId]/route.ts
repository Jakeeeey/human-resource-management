import { NextRequest, NextResponse } from "next/server";

import {
  deactivateTrainingItem,
  listTrainingItems,
  updateTrainingItem,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";
import { UpdateTrainingItemBodySchema } from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApi.schema";
import {
  invalidId,
  mapTrainingCatalogFailure,
  readTrainingTemplatesSession,
  trainingItemNotFound,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH  /api/hrm/onboarding/training-templates/[id]/items/[itemId] — partial
//        update (title / description / is_required / is_active / sort_order).
//        The item must belong to the template in the path.
// DELETE .../[itemId] — SOFT delete (`is_active=0`); the row stays readable
//        with `?all=1`.

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = readTrainingTemplatesSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId, itemId: rawItemId } = await params;
    const templateId = parseId(rawId);
    const itemId = parseId(rawItemId);
    if (templateId === null || itemId === null) return invalidId();

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdateTrainingItemBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const items = await listTrainingItems(templateId, {
      includeInactive: true,
    });
    if (!items.some((item) => item.id === itemId)) {
      return trainingItemNotFound();
    }

    const updated = await updateTrainingItem({
      id: itemId,
      patch: validation.data,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[training-templates] item update error:", error);
    return mapTrainingCatalogFailure(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = readTrainingTemplatesSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId, itemId: rawItemId } = await params;
    const templateId = parseId(rawId);
    const itemId = parseId(rawItemId);
    if (templateId === null || itemId === null) return invalidId();

    const items = await listTrainingItems(templateId, {
      includeInactive: true,
    });
    if (!items.some((item) => item.id === itemId)) {
      return trainingItemNotFound();
    }

    const deleted = await deactivateTrainingItem({
      id: itemId,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("[training-templates] item delete error:", error);
    return mapTrainingCatalogFailure(error);
  }
}
