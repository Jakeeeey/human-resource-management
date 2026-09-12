import { NextRequest, NextResponse } from "next/server";

import {
  createTemplateRows,
  listTemplateRows,
  type TemplateWriteRow,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  REQUIREMENTS_ERROR_CODES,
  mapRequirementsFailure,
  nextSortOrder,
  phTimeNow,
  readAllFlag,
  readRequirementsSession,
  requirementsConflict,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import {
  CreateTaskTemplateBodySchema,
  RequirementsTaskPhaseSchema,
  isManagedTemplatePhase,
} from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/requirements/task-templates — the template catalog
//      for the documents / training / equipment phases (orientation-phase
//      templates are DERIVED from orientation topics and are managed through
//      the orientation section). `?phase=` narrows to one phase; `?all=1`
//      includes deactivated rows. Default: active only.
// POST — create a template (`.strict()` body; `code` immutable after create).

export async function GET(req: NextRequest) {
  try {
    if (!readRequirementsSession(req).ok) return unauthorized();

    const phase = req.nextUrl.searchParams.get("phase");
    let phaseFilter: string | null = null;
    if (phase !== null) {
      const parsed = RequirementsTaskPhaseSchema.safeParse(phase);
      if (!parsed.success) {
        return validationFailed({
          phase: ["phase must be one of documents, training, equipment"],
        });
      }
      phaseFilter = parsed.data;
    }

    const rows = await listTemplateRows({ activeOnly: !readAllFlag(req) });
    const data = rows.filter((row) =>
      phaseFilter === null
        ? isManagedTemplatePhase(row.phase)
        : row.phase === phaseFilter
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[requirements-task-templates] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateTaskTemplateBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = await listTemplateRows();
    if (current.some((row) => row.code === validation.data.code)) {
      return requirementsConflict(
        REQUIREMENTS_ERROR_CODES.rowExists,
        "A task template with this code already exists"
      );
    }

    const now = phTimeNow();
    const write: TemplateWriteRow = {
      code: validation.data.code,
      title: validation.data.title,
      phase: validation.data.phase,
      owner_role: validation.data.owner_role,
      is_required: validation.data.is_required ?? true,
      sort_order: validation.data.sort_order ?? nextSortOrder(current),
      created_at: now,
      created_by: session.actorId,
      updated_at: now,
      updated_by: session.actorId,
    };
    const created = await createTemplateRows([write]);
    return NextResponse.json(
      { success: true, data: created[0] ?? null },
      { status: 201 }
    );
  } catch (error) {
    console.error("[requirements-task-templates] create error:", error);
    return mapRequirementsFailure(error);
  }
}
