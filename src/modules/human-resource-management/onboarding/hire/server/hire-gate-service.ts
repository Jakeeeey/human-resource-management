import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import { nowUTC } from "@/modules/human-resource-management/shared/utils/audit";
import {
  setApplicantStatus,
} from "@/modules/human-resource-management/shared/services/applicant-status-service";
import type { ApplicantStatus } from "@/modules/human-resource-management/onboarding/types/applicant-status";
import {
  listOnboardingTasks,
  updateOnboardingTask,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboarding-task-service";
import {
  ensureOnboardingTaskTemplates,
  listOnboardingTaskTemplates,
} from "@/modules/human-resource-management/onboarding/tasks/server/task-template-service";
import {
  createTaskRows,
  listTaskRows,
  readUserExists,
  ONBOARDING_TASK_ERROR_CODES,
  type TaskWriteRow,
} from "@/modules/human-resource-management/onboarding/tasks/server/onboardingTaskIo";
import {
  listTrainingItemRows,
  readUserDepartmentId,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogIo";
import {
  listTrainingTemplates,
  trainingItemCode,
} from "@/modules/human-resource-management/onboarding/training/server/trainingCatalogService";
import type { OnboardingTaskTemplate } from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";
import {
  readHireApplicant,
  readHireApplicationByApplicant,
  readHireRecruitmentProfile,
  resolveHireApplicantIdByUserId,
} from "@/modules/human-resource-management/onboarding/hire/server/hire-application";
import { runHireOrchestrator } from "@/modules/human-resource-management/onboarding/hire/server/hire-orchestrator";
import { ONBOARDING_TASK_MATERIALIZE_STEP_NAME } from "@/modules/human-resource-management/onboarding/hire/server/onboarding-task-materialize-step";
import { logHireActivity } from "@/modules/human-resource-management/onboarding/hire/server/hire-log";
import type {
  HireGateChoice,
  HireGatePendingItem,
  HireGateState,
  HireGateTemplateOption,
} from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";

export const HIRE_GATE_ERROR_CODES = {
  invalidInput: "HIRE_GATE_INVALID_INPUT",
  applicantNotFound: "HIRE_GATE_APPLICANT_NOT_FOUND",
  invalidState: "HIRE_GATE_INVALID_STATE",
  templateNotApplicable: "HIRE_GATE_TEMPLATE_NOT_APPLICABLE",
  templateEmpty: "HIRE_GATE_TEMPLATE_EMPTY",
  readFailed: "HIRE_GATE_READ_FAILED",
} as const;

const GATE_ALLOWED_STATUSES: ApplicantStatus[] = [
  "signing_complete",
  "for_training",
];

const UserIdRowSchema = z.object({
  data: z.array(z.object({ user_id: z.number().int().positive() })),
});

const PendingApplicantRowSchema = z.looseObject({
  id: z.number().int().positive(),
  full_name: z.string().nullish(),
  status: z.string(),
  position_applied_for: z.string().nullish(),
});

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function directusErrorMessage(body: unknown): string | null {
  const parsed = z
    .object({ errors: z.array(z.object({ message: z.string() })).min(1) })
    .safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.errors.map((error) => error.message).join("; ");
}

function unwrapList(body: unknown): unknown[] | null {
  if (typeof body === "object" && body !== null && "data" in body) {
    const data = (body as { data: unknown }).data;
    return Array.isArray(data) ? data : null;
  }
  return null;
}

export async function resolveHireUserIdByApplicant(
  applicantId: number
): Promise<number | null> {
  const linkBody: unknown = await dFetch(
    `/items/user?filter[applicant_id][_eq]=${applicantId}&fields=user_id&sort=user_id&limit=1`
  );
  if (directusErrorMessage(linkBody)) {
    fail(
      HIRE_GATE_ERROR_CODES.readFailed,
      `user lookup for applicant ${applicantId} failed`
    );
  }
  const linkParsed = UserIdRowSchema.safeParse(linkBody);
  if (!linkParsed.success) {
    fail(
      HIRE_GATE_ERROR_CODES.readFailed,
      `user lookup for applicant ${applicantId} answered an unreadable body`
    );
  }
  const linked = linkParsed.data.data[0]?.user_id ?? null;
  if (linked !== null) return linked;
  const application = await readHireApplicationByApplicant(applicantId);
  const email =
    typeof application?.email === "string" &&
    application.email.trim().length > 0
      ? application.email.trim()
      : null;
  if (!email) return null;
  const encoded = encodeURIComponent(email);
  const body: unknown = await dFetch(
    `/items/user?filter[_or][0][personal_email][_eq]=${encoded}&filter[_or][1][user_email][_eq]=${encoded}&fields=user_id&sort=user_id&limit=1`
  );
  if (directusErrorMessage(body)) {
    fail(
      HIRE_GATE_ERROR_CODES.readFailed,
      `user lookup for applicant ${applicantId} failed`
    );
  }
  const parsed = UserIdRowSchema.safeParse(body);
  if (!parsed.success) {
    fail(
      HIRE_GATE_ERROR_CODES.readFailed,
      `user lookup for applicant ${applicantId} answered an unreadable body`
    );
  }
  return parsed.data.data[0]?.user_id ?? null;
}

function toTemplateOption(entry: {
  id: number;
  code: string;
  title: string;
  description: string | null;
  department_ids: number[];
  itemCount: number;
  requiredItemCount: number;
}): HireGateTemplateOption {
  return {
    ...entry,
    global: entry.department_ids.length === 0,
  };
}

export async function getHireGateState(input: {
  applicantId?: number;
  userId?: number;
}): Promise<HireGateState> {
  let applicantId = input.applicantId ?? null;
  if (applicantId === null && input.userId !== undefined) {
    applicantId = await resolveHireApplicantIdByUserId(input.userId);
  }
  if (applicantId === null) {
    fail(
      HIRE_GATE_ERROR_CODES.applicantNotFound,
      "no applicant is linked to this hire"
    );
  }
  const resolvedApplicantId = applicantId as number;
  const applicant = await readHireApplicant(resolvedApplicantId);
  if (!applicant) {
    fail(
      HIRE_GATE_ERROR_CODES.applicantNotFound,
      `applicant ${resolvedApplicantId} does not exist`
    );
  }
  const status = applicant?.status ?? "signing_complete";
  const userId =
    input.userId ?? (await resolveHireUserIdByApplicant(resolvedApplicantId));

  const departmentId =
    userId === null || userId === undefined
      ? (await readHireRecruitmentProfile(resolvedApplicantId)).departmentId
      : await readUserDepartmentId(userId);

  const catalog = await listTrainingTemplates();
  const templates: HireGateTemplateOption[] = catalog
    .filter((template) => template.is_active === true)
    .filter((template) =>
      departmentId === null
        ? template.department_ids.length === 0
        : template.department_ids.length === 0 ||
          template.department_ids.includes(departmentId)
    )
    .sort((a, b) => a.id - b.id)
    .map((template) => {
      const activeItems = template.items.filter(
        (item) => item.is_active === true
      );
      return toTemplateOption({
        id: template.id,
        code: template.code,
        title: template.title,
        description: template.description,
        department_ids: template.department_ids,
        itemCount: activeItems.length,
        requiredItemCount: activeItems.filter((item) => item.is_required)
          .length,
      });
    });

  let trainingTaskCount = 0;
  if (userId !== null && userId !== undefined) {
    const [tasks, taskTemplates] = await Promise.all([
      listOnboardingTasks({ userId }),
      listOnboardingTaskTemplates(),
    ]);
    const phaseByTemplate = new Map(
      taskTemplates.map((template) => [template.id, template.phase])
    );
    trainingTaskCount = tasks.filter(
      (task) =>
        task.template_id !== null &&
        phaseByTemplate.get(task.template_id) === "training"
    ).length;
  }

  return {
    applicantId: resolvedApplicantId,
    applicantName:
      applicant?.full_name?.trim() || `Applicant #${resolvedApplicantId}`,
    applicantStatus: status,
    userId: userId ?? null,
    departmentId,
    needsTrainingChoice: status === "for_training" && trainingTaskCount === 0,
    trainingTaskCount,
    templates,
  };
}

export async function listPendingHireGates(): Promise<HireGatePendingItem[]> {
  const body: unknown = await dFetch(
    "/items/applicant?filter[status][_eq]=signing_complete&fields=id,full_name,status,position_applied_for&sort=id&limit=-1"
  );
  if (directusErrorMessage(body)) {
    fail(
      HIRE_GATE_ERROR_CODES.readFailed,
      "signing-complete applicant list failed"
    );
  }
  const rows = unwrapList(body) ?? [];
  const pending: HireGatePendingItem[] = [];
  for (const raw of rows) {
    const parsed = PendingApplicantRowSchema.safeParse(raw);
    if (!parsed.success || parsed.data.status !== "signing_complete") continue;
    let userId: number | null = null;
    try {
      userId = await resolveHireUserIdByApplicant(parsed.data.id);
    } catch {
      userId = null;
    }
    pending.push({
      applicantId: parsed.data.id,
      name: parsed.data.full_name?.trim() || `Applicant #${parsed.data.id}`,
      status: "signing_complete",
      position: parsed.data.position_applied_for?.trim() || null,
      userId,
    });
  }
  return pending;
}

async function materializeNonTrainingTasks(
  userId: number,
  actorId: number | null
): Promise<{ created: number; total: number }> {
  const userExists = await readUserExists(userId);
  if (!userExists) {
    fail(
      ONBOARDING_TASK_ERROR_CODES.userNotFound,
      `user ${userId} does not exist`
    );
  }
  const { templates: allTemplates } = await ensureOnboardingTaskTemplates({
    actorId,
  });
  const targets = allTemplates.filter(
    (template) => template.is_active && template.phase !== "training"
  );
  const current = await listTaskRows({ userId });
  const currentTemplateIds = new Set(
    current
      .map((task) => task.template_id)
      .filter((id): id is number => id !== null)
  );
  const missing = targets.filter(
    (template) => !currentTemplateIds.has(template.id)
  );
  const now = nowUTC();
  const rows: TaskWriteRow[] = missing.map((template) => ({
    user_id: userId,
    template_id: template.id,
    owner_role: template.owner_role,
    owner_user_id: null,
    status: "pending",
    due_date: null,
    completed_by: null,
    completed_at: null,
    notes: null,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  }));
  if (rows.length > 0) await createTaskRows(rows);
  const after = await listTaskRows({ userId });
  const afterTemplateIds = new Set(
    after.map((task) => task.template_id).filter((id) => id !== null)
  );
  const missingAfter = targets.filter(
    (template) => !afterTemplateIds.has(template.id)
  );
  if (missingAfter.length > 0) {
    fail(
      ONBOARDING_TASK_ERROR_CODES.taskWriteFailed,
      `templates without a task after materialize: ${missingAfter
        .map((template) => template.code)
        .join(",")}`
    );
  }
  return { created: rows.length, total: after.length };
}

async function materializeChosenTrainingTasks(
  userId: number,
  trainingTemplateId: number,
  actorId: number | null
): Promise<{ created: number; templateCodes: string[] }> {
  await ensureOnboardingTaskTemplates({ actorId });
  const items = await listTrainingItemRows(trainingTemplateId);
  if (items.length === 0) {
    fail(
      HIRE_GATE_ERROR_CODES.templateEmpty,
      `training template ${trainingTemplateId} has no active items`
    );
  }
  const codes = items.map((item) => trainingItemCode(item.id));
  const catalog: OnboardingTaskTemplate[] = await listOnboardingTaskTemplates();
  const targets = catalog.filter(
    (template) => template.is_active && codes.includes(template.code)
  );
  const missingCodes = codes.filter(
    (code) => !targets.some((template) => template.code === code)
  );
  if (missingCodes.length > 0) {
    fail(
      ONBOARDING_TASK_ERROR_CODES.templateWriteFailed,
      `training items without a task template: ${missingCodes.join(",")}`
    );
  }
  const current = await listTaskRows({ userId });
  const currentTemplateIds = new Set(
    current
      .map((task) => task.template_id)
      .filter((id): id is number => id !== null)
  );
  const missing = targets.filter(
    (template) => !currentTemplateIds.has(template.id)
  );
  const now = nowUTC();
  const rows: TaskWriteRow[] = missing.map((template) => ({
    user_id: userId,
    template_id: template.id,
    owner_role: template.owner_role,
    owner_user_id: null,
    status: "pending",
    due_date: null,
    completed_by: null,
    completed_at: null,
    notes: null,
    created_at: now,
    created_by: actorId,
    updated_at: now,
    updated_by: actorId,
  }));
  if (rows.length > 0) await createTaskRows(rows);
  const after = await listTaskRows({ userId });
  const afterTemplateIds = new Set(
    after.map((task) => task.template_id).filter((id) => id !== null)
  );
  const missingAfter = targets.filter(
    (template) => !afterTemplateIds.has(template.id)
  );
  if (missingAfter.length > 0) {
    fail(
      ONBOARDING_TASK_ERROR_CODES.taskWriteFailed,
      `training templates without a task after materialize: ${missingAfter
        .map((template) => template.code)
        .join(",")}`
    );
  }
  return {
    created: rows.length,
    templateCodes: targets.map((template) => template.code),
  };
}

async function waiveTrainingTasksForEmployment(
  userId: number,
  actorId: number | null
): Promise<number> {
  const [tasks, templates] = await Promise.all([
    listOnboardingTasks({ userId }),
    listOnboardingTaskTemplates(),
  ]);
  const phaseByTemplate = new Map(
    templates.map((template) => [template.id, template.phase])
  );
  const trainingTasks = tasks.filter(
    (task) =>
      task.template_id !== null &&
      phaseByTemplate.get(task.template_id) === "training" &&
      task.status !== "na"
  );
  for (const task of trainingTasks) {
    await updateOnboardingTask({
      taskId: task.id,
      patch: { status: "na" },
      actorId,
    });
  }
  return trainingTasks.length;
}

export interface RunHireGateChoiceInput {
  applicantId: number;
  choice: HireGateChoice;
  trainingTemplateId?: number;
  actorId?: number | null;
}

export async function runHireGateChoice(
  input: RunHireGateChoiceInput
): Promise<HireGateState> {
  const actorId = input.actorId ?? null;
  const applicant = await readHireApplicant(input.applicantId);
  if (!applicant) {
    fail(
      HIRE_GATE_ERROR_CODES.applicantNotFound,
      `applicant ${input.applicantId} does not exist`
    );
  }
  const status = applicant?.status ?? "signing_complete";
  if (!GATE_ALLOWED_STATUSES.includes(status)) {
    fail(
      HIRE_GATE_ERROR_CODES.invalidState,
      `applicant ${input.applicantId} is "${status}", not "signing_complete" or "for_training"`
    );
  }

  if (input.choice === "employment") {
    const orchestrated = await runHireOrchestrator({
      applicantId: input.applicantId,
      ...(actorId !== null ? { actorId } : {}),
      allowedStatuses: [...GATE_ALLOWED_STATUSES],
    });
    const waived = await waiveTrainingTasksForEmployment(
      orchestrated.userId,
      actorId
    );
    await setApplicantStatus({
      applicantId: input.applicantId,
      status: "hired",
      ...(actorId !== null ? { actorId } : {}),
    });
    await logHireActivity({
      userId: orchestrated.userId,
      userName: `Applicant #${input.applicantId}`,
      userEmail: orchestrated.email,
      ok: true,
      reason: `hire-gate employment: applicant=${input.applicantId} user_id=${orchestrated.userId} training_tasks_waived=${waived}`,
    });
    return getHireGateState({ applicantId: input.applicantId });
  }

  const preexistingUserId = await resolveHireUserIdByApplicant(
    input.applicantId
  );
  let userId: number;
  if (preexistingUserId !== null) {
    userId = preexistingUserId;
  } else {
    const orchestrated = await runHireOrchestrator({
      applicantId: input.applicantId,
      ...(actorId !== null ? { actorId } : {}),
      allowedStatuses: [...GATE_ALLOWED_STATUSES],
      skipSteps: [ONBOARDING_TASK_MATERIALIZE_STEP_NAME],
    });
    userId = orchestrated.userId;
    await logHireActivity({
      userId,
      userName: `Applicant #${input.applicantId}`,
      userEmail: orchestrated.email,
      ok: true,
      reason: `hire-gate training: applicant=${input.applicantId} user_id=${userId}`,
    });
  }
  await materializeNonTrainingTasks(userId, actorId);
  await setApplicantStatus({
    applicantId: input.applicantId,
    status: "for_training",
    ...(actorId !== null ? { actorId } : {}),
  });

  if (input.trainingTemplateId !== undefined) {
    const gate = await getHireGateState({ applicantId: input.applicantId });
    const chosen = gate.templates.find(
      (template) => template.id === input.trainingTemplateId
    );
    if (!chosen) {
      fail(
        HIRE_GATE_ERROR_CODES.templateNotApplicable,
        `training template ${input.trainingTemplateId} is not applicable to applicant ${input.applicantId}`
      );
    }
    const materialized = await materializeChosenTrainingTasks(
      userId,
      input.trainingTemplateId as number,
      actorId
    );
    await logHireActivity({
      userId,
      userName: gate.applicantName,
      userEmail: `applicant-${input.applicantId}@hire-gate.local`,
      ok: true,
      reason: `hire-gate training choice: applicant=${input.applicantId} user_id=${userId} training_template=${input.trainingTemplateId} created=${materialized.created} codes=[${materialized.templateCodes.join(",")}]`,
    });
  }

  return getHireGateState({ applicantId: input.applicantId });
}
