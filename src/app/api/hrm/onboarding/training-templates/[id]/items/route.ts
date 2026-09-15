import { NextRequest, NextResponse } from "next/server";

import {
  createTrainingItem,
  listTrainingItems,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";
import { CreateTrainingItemBodySchema } from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApi.schema";
import {
  invalidId,
  mapTrainingCatalogFailure,
  readAllFlag,
  readTrainingTemplatesSession,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/training-templates/[id]/items — one template's
//      items, `sort_order` order. Default: active items only; `?all=1`
//      includes deactivated items.
// POST .../items — create an item under the template (`.strict()` body;
//      `template_id` comes from the path, never the body).

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!readTrainingTemplatesSession(req).ok) return unauthorized();

    const { id: rawId } = await params;
    const id = parseId(rawId);
    if (id === null) return invalidId();

    const data = await listTrainingItems(id, {
      includeInactive: readAllFlag(req),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[training-templates] item list error:", error);
    return mapTrainingCatalogFailure(error);
  }
}

export async function POST(
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
    const validation = CreateTrainingItemBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const created = await createTrainingItem({
      ...validation.data,
      templateId: id,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[training-templates] item create error:", error);
    return mapTrainingCatalogFailure(error);
  }
}
