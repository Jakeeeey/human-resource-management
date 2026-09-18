import { NextRequest, NextResponse } from "next/server";

import { listTopicRows, readTopicRowByCode } from "@/modules/human-resource-management/onboarding/orientation/server/orientationTopicIo";
import { upsertTopic } from "@/modules/human-resource-management/onboarding/orientation/orientationStore";
import {
  REQUIREMENTS_ERROR_CODES,
  mapRequirementsFailure,
  readAllFlag,
  readRequirementsSession,
  requirementsConflict,
  serverError,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { CreateOrientationTopicBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/hrm/onboarding/requirements/orientation — topic catalog. Default:
//      active only; `?all=1` includes deactivated topics.
// POST — create a topic via the pinned `upsertTopic` path (code composed from
//      the title when absent; an explicit existing code answers 409). No role
//      gate — the session supplies the audit actor only.

export async function GET(req: NextRequest) {
  try {
    if (!readRequirementsSession(req).ok) return unauthorized();
    const rows = await listTopicRows({ activeOnly: !readAllFlag(req) });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("[requirements-orientation] list error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readRequirementsSession(req);
    if (!session.ok) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = CreateOrientationTopicBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }
    const data = validation.data;

    if (data.code !== undefined) {
      const existing = await readTopicRowByCode(data.code);
      if (existing) {
        return requirementsConflict(
          REQUIREMENTS_ERROR_CODES.rowExists,
          "An orientation topic with this code already exists"
        );
      }
    }

    const topic = await upsertTopic({
      id: data.code,
      track: data.track,
      title: data.title,
      required: data.is_required,
      actorId: session.actorId,
    });
    const row = await readTopicRowByCode(topic.id);
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    console.error("[requirements-orientation] create error:", error);
    return mapRequirementsFailure(error);
  }
}
