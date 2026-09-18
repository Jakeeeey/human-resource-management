import { NextRequest, NextResponse } from "next/server";

import {
  createTrainingTemplate,
  listTrainingTemplates,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";
import { CreateTrainingTemplateBodySchema } from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApi.schema";
import {
  mapTrainingCatalogFailure,
  readAllFlag,
  readTrainingTemplatesSession,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/training/server/trainingTemplatesApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/training-templates — the per-department template
//      catalog with each template's items nested. Default: active rows only;
//      `?all=1` includes deactivated templates and items. No role gate — the
//      session supplies the audit actor only.
// POST /api/hrm/onboarding/training-templates — create a template (`.strict()`
//      body; `code` immutable after create).

export async function GET(req: NextRequest) {
  try {
    if (!readTrainingTemplatesSession(req).ok) return unauthorized();

    const data = await listTrainingTemplates({
      includeInactive: readAllFlag(req),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[training-templates] list error:", error);
    return mapTrainingCatalogFailure(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readTrainingTemplatesSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateTrainingTemplateBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const created = await createTrainingTemplate({
      ...validation.data,
      actorId: session.actorId,
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[training-templates] create error:", error);
    return mapTrainingCatalogFailure(error);
  }
}
