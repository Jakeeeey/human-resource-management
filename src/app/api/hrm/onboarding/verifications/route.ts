import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  dispatchMail,
  type DispatchCtx,
} from "@/modules/human-resource-management/recruitment/mailing/utils/dispatchMail";
import { logRedacted } from "@/modules/human-resource-management/recruitment/mailing/utils/mailLog";
import { buildCompletionDedupKey } from "@/modules/human-resource-management/onboarding/completion/completionChecklist";
import {
  completeOnboardingTask,
  listOnboardingTasks,
  updateOnboardingTask,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import {
  readOnboardingTaskSession,
  sessionActorId,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskApiServer";
import { listOnboardingTaskTemplates } from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import {
  DocumentDecisionSchema,
  rollupDocumentState,
  type DocumentDecision,
  type DocumentVerificationState,
} from "@/modules/human-resource-management/onboarding/verification/types/document-verification.schema";
import {
  listDocumentVerificationsByUser,
  upsertDocumentDecision,
  type DocumentVerificationEntry,
} from "@/modules/human-resource-management/onboarding/verification/server/documentVerificationIo";
import {
  aggregateQueue,
  buildQueueRow,
  findVerificationTasks,
  VerificationDecisionSchema,
} from "@/modules/human-resource-management/onboarding/verification/types/verification-queue.schema";
import type { QueueDocument } from "@/modules/human-resource-management/onboarding/verification/types/verification-queue.schema";
import { parsePortalFileMarker } from "@/modules/human-resource-management/employee-portal";
import { listActiveDocSlotConfig } from "@/modules/human-resource-management/employee-portal/server/documentSlotIo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// verifications — HR verification queue over the EMPLOYEE's documents tasks.
//
// GET — queue read: every employee owning `documents`-phase `onboarding_task`
// rows, aggregated into pending / returned / approved from the
// `documents_hr_verified` task (see verification-queue.schema.ts).
// There is no `onboarding_profiles` read and no profile status gate.
// POST — one decision per call: approve | return(reason) | resubmit. The
// decision writes the `documents_hr_verified` task through the todo-19 task
// engine (the ONLY status writer) and re-reads before answering, so a 200 can
// never report a write that is not visible. Approve dispatches the frozen
// `onboarding.docs_verified` event keyed to the employee (never awaited).

function validationFailed(errors: Record<string, string[]>) {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

function serverError() {
  return NextResponse.json(
    { success: false, message: "An unexpected error occurred. Please try again later." },
    { status: 500 }
  );
}

const EmployeeRowSchema = z.object({
  user_id: z.number().int().positive(),
  user_email: z.string().nullable().optional(),
});

interface VerificationEmployee {
  user_id: number;
  user_email: string | null;
}

/**
 * Reads the employee row (existence + notification email).
 * @returns The employee, or null when the row does not exist.
 * @throws Coded error when the lookup itself fails (never a false "missing").
 */
async function readEmployee(userId: number): Promise<VerificationEmployee | null> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_email&limit=1`
  );
  const parsed = z.object({ data: z.array(EmployeeRowSchema) }).safeParse(body);
  if (!parsed.success) {
    throw new Error(
      `VERIFICATION_USER_READ_FAILED: user ${userId} lookup failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  const row = parsed.data.data[0];
  if (!row) return null;
  const email =
    typeof row.user_email === "string" && row.user_email.trim().length > 0
      ? row.user_email.trim()
      : null;
  return { user_id: row.user_id, user_email: email };
}

const PORTAL_EMPLOYEE_MARKER = "onboarding-portal:employee:";

const PortalFilesSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().min(1),
      description: z.unknown(),
      uploaded_on: z.string().nullish(),
    })
  ),
});

async function readPortalDocumentsByUser(): Promise<Map<number, QueueDocument[]>> {
  const [body, slots] = await Promise.all([
    dFetch(
      `/files?filter[description][_contains]=${encodeURIComponent(PORTAL_EMPLOYEE_MARKER)}&fields=id,description,uploaded_on&limit=-1`
    ),
    listActiveDocSlotConfig(),
  ]);
  const parsed = PortalFilesSchema.safeParse(body);
  if (!parsed.success) return new Map();
  const titleByKey = new Map(slots.map((slot) => [slot.key, slot.title]));
  const byUser = new Map<number, Map<string, QueueDocument>>();
  for (const row of parsed.data.data) {
    const marker = parsePortalFileMarker(row.description);
    if (!marker || marker.key.kind !== "employee") continue;
    const slotMap = byUser.get(marker.key.id) ?? new Map<string, QueueDocument>();
    const candidate: QueueDocument = {
      docKey: marker.doc_key,
      title: titleByKey.get(marker.doc_key) ?? marker.doc_key,
      fileId: row.id,
      uploadedAt: row.uploaded_on ?? null,
      state: "pending",
      returnReason: null,
    };
    // One slot = one row: a marker left on a superseded file must not render a
    // duplicate, so the newest upload wins.
    const current = slotMap.get(marker.doc_key);
    if (!current || (candidate.uploadedAt ?? "") > (current.uploadedAt ?? "")) {
      slotMap.set(marker.doc_key, candidate);
    }
    byUser.set(marker.key.id, slotMap);
  }
  const documentsByUser = new Map<number, QueueDocument[]>();
  for (const [userId, slotMap] of byUser) {
    documentsByUser.set(userId, [...slotMap.values()]);
  }
  return documentsByUser;
}

function joinDocumentVerifications(
  documentsByUser: Map<number, QueueDocument[]>,
  verificationsByUser: ReadonlyMap<
    number,
    ReadonlyMap<string, DocumentVerificationEntry>
  >
): void {
  for (const [userId, docs] of documentsByUser) {
    const byDoc = verificationsByUser.get(userId);
    if (!byDoc) continue;
    for (const doc of docs) {
      const entry = byDoc.get(doc.docKey);
      if (entry) {
        doc.state = entry.state;
        doc.returnReason = entry.reason;
      }
    }
  }
}

// The employee-scoped `onboarding.docs_verified` dispatch context: no
// applicant<->user link, so the bridge is synthetic and recipient resolution
// falls back to the `to_email` override; a miss records `skipped`, never a
// wrong-person send, still under the employee dedup key.
function buildDocsVerifiedCtx(
  userId: number,
  toEmail: string | null
): DispatchCtx {
  const ctx: DispatchCtx = {
    event_key: "onboarding.docs_verified",
    application_id: `onboarding-user:${userId}`,
    vars: {
      user_id: String(userId),
      employee_id: String(userId),
      status: "HR_VERIFIED",
    },
    idempotency_key: buildCompletionDedupKey(userId, "onboarding.docs_verified"),
  };
  if (toEmail) ctx.to_email = toEmail;
  return ctx;
}

export async function GET() {
  try {
    const [tasks, templates, documentsByUser, verificationsByUser] =
      await Promise.all([
        listOnboardingTasks({}),
        listOnboardingTaskTemplates(),
        readPortalDocumentsByUser(),
        listDocumentVerificationsByUser(),
      ]);

    joinDocumentVerifications(documentsByUser, verificationsByUser);

    return NextResponse.json({
      success: true,
      data: aggregateQueue(tasks, templates, documentsByUser),
    });
  } catch (error) {
    console.error("[onboarding-verifications] queue error:", error);
    return serverError();
  }
}

async function handleDocumentDecision(input: {
  userId: number;
  docKey: string;
  decision: DocumentDecision;
  reason: string | undefined;
  actorId: number | null;
}): Promise<NextResponse> {
  const { userId, docKey, decision, reason, actorId } = input;
  const [tasks, templates, employee, documentsByUser] = await Promise.all([
    listOnboardingTasks({ userId }),
    listOnboardingTaskTemplates(),
    readEmployee(userId),
    readPortalDocumentsByUser(),
  ]);
  if (!employee) {
    return NextResponse.json(
      { success: false, message: "The employee does not exist" },
      { status: 400 }
    );
  }
  const docs = documentsByUser.get(userId) ?? [];
  if (!docs.some((doc) => doc.docKey === docKey)) {
    return NextResponse.json(
      {
        success: false,
        message: `Document "${docKey}" is not a document on employee #${userId}`,
      },
      { status: 400 }
    );
  }
  const pair = findVerificationTasks(tasks, templates);
  if (!pair.hr) {
    return NextResponse.json(
      {
        success: false,
        message: `Employee #${userId} has no onboarding documents tasks`,
      },
      { status: 400 }
    );
  }
  if (pair.submitted?.status !== "done") {
    return NextResponse.json(
      {
        success: false,
        message:
          "Documents are not submitted yet — only submitted documents can be verified",
      },
      { status: 400 }
    );
  }

  const state: DocumentVerificationState =
    decision === "approve" ? "approved" : "returned";
  const cleanReason = decision === "return" ? (reason ?? "").trim() : null;

  await upsertDocumentDecision({
    userId,
    docKey,
    state,
    reason: cleanReason,
    decidedBy: actorId,
  });

  const verificationsByUser = await listDocumentVerificationsByUser();
  joinDocumentVerifications(documentsByUser, verificationsByUser);
  const verByDoc = verificationsByUser.get(userId);
  const rollup = rollupDocumentState(
    docs.map((doc) => verByDoc?.get(doc.docKey)?.state ?? "pending")
  );

  if (rollup === "approved") {
    await completeOnboardingTask({ taskId: pair.hr.id, completedBy: actorId });
  } else if (rollup === "returned") {
    const returnedReason = docs
      .map((doc) => verByDoc?.get(doc.docKey))
      .find((entry) => entry?.state === "returned")?.reason;
    await updateOnboardingTask({
      taskId: pair.hr.id,
      patch: { status: "blocked", notes: returnedReason ?? cleanReason },
    });
  } else {
    await updateOnboardingTask({
      taskId: pair.hr.id,
      patch: { status: "pending", notes: null },
    });
  }

  const afterTasks = await listOnboardingTasks({ userId });
  const row = buildQueueRow(userId, afterTasks, templates, docs);
  if (!row || row.queueState !== rollup) {
    console.error("[onboarding-verifications] document decision not visible:", {
      userId,
      docKey,
      decision,
      rollup,
      row,
    });
    return serverError();
  }

  const message =
    decision === "approve"
      ? "Document approved"
      : "Document returned for resubmit with reason";
  return NextResponse.json({ success: true, data: row, message });
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null);
    const validation = VerificationDecisionSchema.safeParse(body);
    if (!validation.success) {
      return validationFailed(validation.error.flatten().fieldErrors);
    }

    const { user_id: userId, doc_key: docKey, decision, reason } = validation.data;
    const session = readOnboardingTaskSession(req);
    const actorId = session ? sessionActorId(session) : null;

    if (docKey !== undefined) {
      const docValidation = DocumentDecisionSchema.safeParse(body);
      if (!docValidation.success) {
        return validationFailed(docValidation.error.flatten().fieldErrors);
      }
      return handleDocumentDecision({
        userId,
        docKey: docValidation.data.doc_key,
        decision: docValidation.data.decision,
        reason: docValidation.data.reason,
        actorId,
      });
    }

    const [tasks, templates, employee] = await Promise.all([
      listOnboardingTasks({ userId }),
      listOnboardingTaskTemplates(),
      readEmployee(userId),
    ]);
    if (!employee) {
      return NextResponse.json(
        { success: false, message: "The employee does not exist" },
        { status: 400 }
      );
    }

    const pair = findVerificationTasks(tasks, templates);
    if (!pair.submitted || !pair.hr) {
      return NextResponse.json(
        {
          success: false,
          message: `Employee #${userId} has no onboarding documents tasks`,
        },
        { status: 400 }
      );
    }
    if (pair.hr.status === "done") {
      return NextResponse.json(
        {
          success: false,
          message: `Documents for employee #${userId} are already HR verified`,
        },
        { status: 400 }
      );
    }
    if (pair.submitted.status !== "done") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Documents are not submitted yet — only submitted documents can be verified",
        },
        { status: 400 }
      );
    }

    const wasReturned = pair.hr.status === "blocked";

    if (decision === "approve") {
      if (wasReturned) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Document was returned for resubmit — resubmit is required before approval",
          },
          { status: 400 }
        );
      }
      await completeOnboardingTask({ taskId: pair.hr.id, completedBy: actorId });
    } else if (decision === "return") {
      await updateOnboardingTask({
        taskId: pair.hr.id,
        patch: { status: "blocked", notes: (reason ?? "").trim() },
      });
    } else {
      if (!wasReturned) {
        return NextResponse.json(
          {
            success: false,
            message: "Documents were not returned — nothing to resubmit",
          },
          { status: 400 }
        );
      }
      await updateOnboardingTask({
        taskId: pair.hr.id,
        patch: { status: "pending", notes: null },
      });
    }

    // Re-read: a 200 must never report a write that is not visible.
    const afterTasks = await listOnboardingTasks({ userId });
    const row = buildQueueRow(userId, afterTasks, templates);
    const expected =
      decision === "approve"
        ? "approved"
        : decision === "return"
          ? "returned"
          : "pending";
    if (!row || row.queueState !== expected) {
      console.error("[onboarding-verifications] write not visible:", {
        userId,
        decision,
        row,
      });
      return serverError();
    }

    if (decision === "approve") {
      // Stage notify: committed above — never awaited, never throws. Dedup key
      // `<user_id>:onboarding.docs_verified`.
      void dispatchMail(
        "onboarding.docs_verified",
        buildDocsVerifiedCtx(userId, employee.user_email)
      ).catch(logRedacted);
    }

    const message =
      decision === "approve"
        ? "Documents approved"
        : decision === "return"
          ? "Returned for resubmit with reason"
          : "Resubmitted — back in the pending queue";
    return NextResponse.json({ success: true, data: row, message });
  } catch (error) {
    console.error("[onboarding-verifications] decision error:", error);
    return serverError();
  }
}
