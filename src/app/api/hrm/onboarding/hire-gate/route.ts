import { NextRequest, NextResponse } from "next/server";

import {
  HIRE_GATE_ERROR_CODES,
  getHireGateState,
  listPendingHireGates,
  runHireGateChoice,
} from "@/modules/human-resource-management/onboarding/hire/server/hire-gate-service";
import { HIRE_ORCHESTRATOR_ERROR_CODES } from "@/modules/human-resource-management/onboarding/hire/types/hire.schema";
import {
  HireGateGetQuerySchema,
  HireGatePostBodySchema,
} from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";
import {
  readOnboardingTaskSession,
  serverError,
  sessionActorId,
  unauthorized,
  validationFailed,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failureStatus(message: string): number {
  if (message.includes(HIRE_GATE_ERROR_CODES.applicantNotFound)) return 404;
  if (
    message.includes(HIRE_GATE_ERROR_CODES.invalidInput) ||
    message.includes(HIRE_GATE_ERROR_CODES.invalidState) ||
    message.includes(HIRE_GATE_ERROR_CODES.templateNotApplicable) ||
    message.includes(HIRE_GATE_ERROR_CODES.templateEmpty) ||
    message.includes(HIRE_ORCHESTRATOR_ERROR_CODES.applicantNotHired) ||
    message.includes(HIRE_ORCHESTRATOR_ERROR_CODES.applicationNotFound) ||
    message.includes(HIRE_ORCHESTRATOR_ERROR_CODES.positionMissing) ||
    message.includes(HIRE_ORCHESTRATOR_ERROR_CODES.companyMissing)
  ) {
    return 422;
  }
  return 500;
}

export async function GET(req: NextRequest) {
  try {
    if (!readOnboardingTaskSession(req)) return unauthorized();

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = HireGateGetQuerySchema.safeParse(params);
    if (!query.success) {
      return validationFailed(query.error.flatten().fieldErrors);
    }

    if (query.data.scope === "pending") {
      const pending = await listPendingHireGates();
      return NextResponse.json({ success: true, data: { pending } });
    }

    const gate = await getHireGateState({
      ...(query.data.applicant_id !== undefined
        ? { applicantId: query.data.applicant_id }
        : {}),
      ...(query.data.user_id !== undefined
        ? { userId: query.data.user_id }
        : {}),
    });
    return NextResponse.json({ success: true, data: { gate } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(HIRE_GATE_ERROR_CODES.applicantNotFound)) {
      return NextResponse.json(
        { success: false, message },
        { status: 404 }
      );
    }
    console.error("[hire-gate] state error:", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = readOnboardingTaskSession(req);
    if (!session) return unauthorized();

    const body: unknown = await req.json().catch(() => null);
    const validation = HireGatePostBodySchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const gate = await runHireGateChoice({
      applicantId: validation.data.applicant_id,
      choice: validation.data.choice,
      ...(validation.data.training_template_id !== undefined
        ? { trainingTemplateId: validation.data.training_template_id }
        : {}),
      actorId: sessionActorId(session),
    });
    return NextResponse.json({ success: true, data: { gate } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[hire-gate] choice error:", error);
    return NextResponse.json(
      { success: false, message },
      { status: failureStatus(message) }
    );
  }
}
