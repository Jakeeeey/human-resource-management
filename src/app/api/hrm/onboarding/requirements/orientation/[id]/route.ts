import { NextRequest, NextResponse } from "next/server";

import {
  listTopicRows,
  softDeleteTopicRow,
} from "@/modules/human-resource-management/onboarding/orientation/server/orientationTopicIo";
import { patchTopic } from "@/modules/human-resource-management/onboarding/orientation/orientationStore";
import {
  assertTopicNotReferenced,
  hardDeleteItem,
  invalidId,
  mapRequirementsFailure,
  readRequirementsSession,
  requirementsNotFound,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/requirements/server/requirementsApiServer";
import { UpdateOrientationTopicBodySchema } from "@/modules/human-resource-management/onboarding/requirements/types/requirements-api.schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH  /api/hrm/onboarding/requirements/orientation/[id] — partial update
//        (title / is_required / is_active) through the pinned `patchTopic`
//        path, so an is_active flip syncs the derived template (todo 2).
// DELETE .../[id] — SOFT delete (`is_active=0`, same sync). `?hard=1`
//        requests a true DELETE; a topic whose derived template is referenced
//        by a task answers the coded 409 refusal.

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
    const validation = UpdateOrientationTopicBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const current = (await listTopicRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Orientation topic not found");

    const updated = await patchTopic(current.code, {
      title: validation.data.title,
      required: validation.data.is_required,
      is_active: validation.data.is_active,
      actorId: session.actorId,
    });
    if (!updated) return requirementsNotFound("Orientation topic not found");

    const row = (await listTopicRows()).find((r) => r.id === id) ?? null;
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error("[requirements-orientation] update error:", error);
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

    const current = (await listTopicRows()).find((row) => row.id === id);
    if (!current) return requirementsNotFound("Orientation topic not found");

    if (req.nextUrl.searchParams.get("hard") === "1") {
      await assertTopicNotReferenced(current.code);
      await hardDeleteItem("orientation_topic", id);
      return NextResponse.json({ success: true, data: { id, deleted: true } });
    }

    const soft = await softDeleteTopicRow(id, session.actorId);
    return NextResponse.json({ success: true, data: soft });
  } catch (error) {
    console.error("[requirements-orientation] delete error:", error);
    return mapRequirementsFailure(error);
  }
}
