import { NextRequest, NextResponse } from "next/server";

import {
  deactivateTrainingTemplate,
  updateTrainingTemplate,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";
import { UpdateTrainingTemplateBodySchema } from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApi.schema";
import {
  invalidId,
  mapTrainingCatalogFailure,
  readTrainingTemplatesSession,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH  /api/hrm/onboarding/training-templates/[id] — partial update
//        (title / description / department_id / is_active). `code` is
//        immutable after create.
// DELETE .../[id] — SOFT delete (`is_active=0`); the row stays readable with
//        `?all=1`.

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readTrainingTemplatesSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id === null) return invalidId();

    const body: unknown = await req.json().catch(() => null);
    const validation = UpdateTrainingTemplateBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const updated = await updateTrainingTemplate({
      id,
      patch: validation.data,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[training-templates] update error:", error);
    return mapTrainingCatalogFailure(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = readTrainingTemplatesSession(req);
    if (!session.ok) return unauthorized();

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id === null) return invalidId();

    const deleted = await deactivateTrainingTemplate({
      id,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    console.error("[training-templates] delete error:", error);
    return mapTrainingCatalogFailure(error);
  }
}
