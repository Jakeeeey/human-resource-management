import { NextResponse, type NextRequest } from "next/server";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  isAbsentItemError,
  mapWriteFailure,
  notFound,
  ok,
  readSession,
  serverError,
  unauthorized,
  unwrapData,
  validationFailed,
} from "@/modules/human-resource-management/performance-evaluation/server/evaluationApiServer";
import { AcknowledgePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation-api.schema";
import { EmployeePipSchema } from "@/modules/human-resource-management/performance-evaluation/types/performance-evaluation.schema";
import {
  actorIdFromJwt,
  nowPH,
  stampUpdate,
} from "@/modules/human-resource-management/performance-evaluation/utils/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pipId: string }> }
) {
  try {
    const session = readSession(req);
    if (!session) return unauthorized();
    const actorId = actorIdFromJwt(session);
    if (actorId === null) return unauthorized();

    const { pipId: pipIdParam } = await params;
    const pipId = Number(pipIdParam);
    if (!Number.isInteger(pipId) || pipId <= 0) {
      return validationFailed({ pip_id: ["Must be a positive integer"] });
    }

    const payload: unknown = await req.json().catch(() => null);
    const acknowledgement = AcknowledgePipSchema.safeParse(payload);
    if (!acknowledgement.success) {
      return validationFailed(
        acknowledgement.error.flatten().fieldErrors
      );
    }

    const pipBody: unknown = await dFetch(`/items/employee_pip/${pipId}`);
    if (isAbsentItemError(pipBody)) return notFound("PIP not found");
    const pipParsed = EmployeePipSchema.safeParse(unwrapData<unknown>(pipBody));
    if (!pipParsed.success) return serverError();
    if (pipParsed.data.user_id !== actorId) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }
    if (pipParsed.data.employee_acknowledged_at !== null) {
      return ok(pipParsed.data);
    }
    if (pipParsed.data.status !== "open") {
      return NextResponse.json(
        {
          success: false,
          code: "PIP_ALREADY_CLOSED",
          message: "The PIP is already closed",
        },
        { status: 409 }
      );
    }

    const now = nowPH();
    const patched = (await dFetch(`/items/employee_pip/${pipId}`, {
      method: "PATCH",
      body: JSON.stringify(
        stampUpdate(
          {
            employee_ack_user_id: actorId,
            employee_acknowledged_at: now,
            updated_at: now,
          },
          actorId
        )
      ),
    })) as { data?: unknown; errors?: unknown };
    if (patched?.errors || !patched?.data) return mapWriteFailure(patched);

    const readBack: unknown = await dFetch(`/items/employee_pip/${pipId}`);
    const reread = EmployeePipSchema.safeParse(unwrapData<unknown>(readBack));
    if (!reread.success) return serverError();
    return ok(reread.data);
  } catch {
    return serverError();
  }
}
