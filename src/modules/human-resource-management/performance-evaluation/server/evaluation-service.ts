import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";

import {
  EmployeeEvaluationItemSchema,
  EmployeeEvaluationSchema,
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
  EvaluationCriterionSchema,
  EvaluationTrackingSchema,
  RosterRowSchema,
  WorkspaceBundleSchema,
  type EmployeeEvaluation,
  type EmployeePip,
  type EvaluationCriterion,
  type EvaluationTracking,
  type RosterRow,
  type WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import { EVALUATION_ERROR_CODES, unwrapData } from "./evaluationApiServer";
import type { EvaluationCapability } from "./evaluationCapability";
import { computeDueDates, isDateOverdue } from "../utils/probationClock";
import {
  deriveNextAction,
  deriveProbationStatus,
  deriveStage,
  type WorkflowFacts,
} from "../utils/workflow";

const RosterEmployeeSchema = z.object({
  user_id: z.number().int(),
  user_fname: z.string().nullish(),
  user_mname: z.string().nullish(),
  user_lname: z.string().nullish(),
  user_department: z
    .union([
      z.number().int(),
      z.string().regex(/^\d+$/),
      z.object({ department_id: z.number().int() }),
    ])
    .nullish(),
  user_position: z.string().nullish(),
  user_dateOfHire: z.string().nullish(),
  isDeleted: z.unknown().optional(),
  is_deleted: z.unknown().optional(),
  deleted: z.unknown().optional(),
});

type RosterEmployee = z.infer<typeof RosterEmployeeSchema>;

const RosterDepartmentSchema = z.object({
  department_id: z.number().int(),
  department_name: z.string().nullish(),
});

const PROBATION_STATUS_RANK: Record<string, number> = {
  probationary: 0,
  pip_open: 1,
  recommendation_issued: 2,
  regular: 3,
  terminated: 4,
};

function parseRowList<T>(
  schema: z.ZodType<T>,
  body: unknown,
  label: string
): T[] {
  const rows = unwrapData<unknown>(body);
  if (!Array.isArray(rows)) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: ${label} read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return rows.map((entry) => {
    const parsed = schema.safeParse(entry);
    if (!parsed.success) {
      throw new Error(
        `${EVALUATION_ERROR_CODES.readFailed}: ${label} row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
      );
    }
    return parsed.data;
  });
}

function isDeletedValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "object" && "data" in value) {
    const data = value.data;
    if (Array.isArray(data)) return data[0] !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    return normalized === "1" || normalized === "true";
  }
  return Boolean(value);
}

function toFullName(employee: RosterEmployee): string {
  const name = [employee.user_fname, employee.user_mname, employee.user_lname]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim() !== ""
    )
    .join(" ")
    .trim();
  return name === "" ? `User #${employee.user_id}` : name;
}

function toDepartmentId(
  value: RosterEmployee["user_department"]
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return value.department_id > 0 ? value.department_id : null;
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function toWorkflowFacts(
  dateHired: string | null,
  tracking: EvaluationTracking | null,
  allEvaluations: readonly EmployeeEvaluation[],
  pips: readonly EmployeePip[]
): WorkflowFacts {
  const evalTypeById = new Map<number, "first" | "second">();
  for (const evaluation of allEvaluations) {
    evalTypeById.set(evaluation.id, evaluation.eval_type);
  }
  return {
    dateHired,
    regularizedAt: tracking?.regularized_at ?? null,
    terminatedAt: tracking?.terminated_at ?? null,
    recommendationIssuedAt: tracking?.recommendation_issued_at ?? null,
    evaluations: allEvaluations
      .filter((evaluation) => evaluation.voided_at === null)
      .map((evaluation) => ({
        evalType: evaluation.eval_type,
        result: evaluation.result,
        voidedAt: evaluation.voided_at,
      })),
    pips: pips.map((pip) => ({
      evaluationId: pip.evaluation_id,
      evalType: evalTypeById.get(pip.evaluation_id) ?? "first",
      status: pip.status,
    })),
  };
}

function compareRosterRows(left: RosterRow, right: RosterRow): number {
  if (left.is_overdue !== right.is_overdue) return left.is_overdue ? -1 : 1;
  const rankDelta =
    (PROBATION_STATUS_RANK[left.probation_status] ?? 99) -
    (PROBATION_STATUS_RANK[right.probation_status] ?? 99);
  if (rankDelta !== 0) return rankDelta;
  const nameDelta = left.full_name.localeCompare(right.full_name);
  if (nameDelta !== 0) return nameDelta;
  return left.user_id - right.user_id;
}

export async function listEvaluationRoster(
  cap: EvaluationCapability,
  opts?: { includeRegular?: boolean; scopeDepartmentIds?: number[] }
): Promise<RosterRow[]> {
  const [employeeBody, departmentBody, trackingBody, evaluationBody, pipBody] =
    await Promise.all([
      dFetch(
        "/items/user?fields=user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire,isDeleted&limit=-1"
      ),
      dFetch(
        "/items/department?fields=department_id,department_name&limit=-1"
      ),
      dFetch("/items/employee_evaluation_tracking?limit=-1"),
      dFetch("/items/employee_evaluation?limit=-1"),
      dFetch("/items/employee_pip?limit=-1"),
    ]);
  const employees = parseRowList(RosterEmployeeSchema, employeeBody, "user");
  const departments = parseRowList(
    RosterDepartmentSchema,
    departmentBody,
    "department"
  );
  const trackingRows = parseRowList(
    EvaluationTrackingSchema,
    trackingBody,
    "employee_evaluation_tracking"
  );
  const evaluationRows = parseRowList(
    EmployeeEvaluationSchema,
    evaluationBody,
    "employee_evaluation"
  );
  const pipRows = parseRowList(EmployeePipSchema, pipBody, "employee_pip");

  const departmentNames = new Map<number, string>();
  for (const department of departments) {
    const name = normalizeText(department.department_name);
    if (name !== null) departmentNames.set(department.department_id, name);
  }
  const trackingByUser = new Map<number, EvaluationTracking>();
  for (const row of trackingRows) {
    if (!trackingByUser.has(row.user_id)) trackingByUser.set(row.user_id, row);
  }
  const evaluationsByUser = new Map<number, EmployeeEvaluation[]>();
  for (const row of evaluationRows) {
    const bucket = evaluationsByUser.get(row.user_id);
    if (bucket === undefined) evaluationsByUser.set(row.user_id, [row]);
    else bucket.push(row);
  }
  const pipsByUser = new Map<number, EmployeePip[]>();
  for (const row of pipRows) {
    const bucket = pipsByUser.get(row.user_id);
    if (bucket === undefined) pipsByUser.set(row.user_id, [row]);
    else bucket.push(row);
  }

  const scopeDepartmentIds =
    opts?.scopeDepartmentIds ?? cap.visibleDepartmentIds;
  const assembled: RosterRow[] = [];
  for (const employee of employees) {
    if (
      isDeletedValue(
        employee.isDeleted ?? employee.is_deleted ?? employee.deleted
      )
    ) {
      continue;
    }
    const departmentId = toDepartmentId(employee.user_department);
    if (scopeDepartmentIds !== null) {
      if (departmentId === null || !scopeDepartmentIds.includes(departmentId)) {
        continue;
      }
    }
    const tracking = trackingByUser.get(employee.user_id) ?? null;
    const dateHired =
      normalizeText(tracking?.date_hired_snapshot) ??
      normalizeText(employee.user_dateOfHire);
    const dueDates = computeDueDates(dateHired);
    const facts = toWorkflowFacts(
      dateHired,
      tracking,
      evaluationsByUser.get(employee.user_id) ?? [],
      pipsByUser.get(employee.user_id) ?? []
    );
    const probationStatus = deriveProbationStatus(facts);
    if (opts?.includeRegular !== true && probationStatus === "regular") {
      continue;
    }
    const stage = deriveStage(facts);
    const thirdMonthDue = dueDates?.third ?? null;
    const fifthMonthDue = dueDates?.fifth ?? null;
    const candidate = {
      user_id: employee.user_id,
      full_name: toFullName(employee),
      department_id: departmentId,
      department_name:
        departmentId === null
          ? null
          : (departmentNames.get(departmentId) ?? null),
      position: normalizeText(employee.user_position),
      date_hired: dateHired,
      third_month_due: thirdMonthDue,
      fifth_month_due: fifthMonthDue,
      sixth_month_due: dueDates?.sixth ?? null,
      probation_status: probationStatus,
      stage,
      next_action: deriveNextAction(facts),
      is_overdue:
        (stage === "first_evaluation" && isDateOverdue(thirdMonthDue)) ||
        (stage === "second_evaluation" && isDateOverdue(fifthMonthDue)),
    };
    const parsed = RosterRowSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(
        `${EVALUATION_ERROR_CODES.readFailed}: roster row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
      );
    }
    assembled.push(parsed.data);
  }
  assembled.sort(compareRosterRows);
  return assembled;
}

async function resolveWorkspaceEmployee(
  userId: number,
  tracking: EvaluationTracking | null
) {
  const employeeBody: unknown = await dFetch(
    `/items/user/${userId}?fields=user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire`
  );
  const employeeData = unwrapData<unknown>(employeeBody);
  const employeeRow = Array.isArray(employeeData) ? employeeData[0] : employeeData;
  const parsedEmployee = RosterEmployeeSchema.safeParse(employeeRow);
  if (!parsedEmployee.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: user read failed (${JSON.stringify(parsedEmployee.error.flatten()).slice(0, 300)})`
    );
  }
  const employee = parsedEmployee.data;
  const departmentId = toDepartmentId(employee.user_department);
  let departmentName: string | null = null;
  if (departmentId !== null) {
    const departmentBody: unknown = await dFetch(
      `/items/department?filter[department_id][_eq]=${departmentId}&fields=department_id,department_name&limit=1`
    );
    const departments = parseRowList(
      RosterDepartmentSchema,
      departmentBody,
      "department"
    );
    departmentName = normalizeText(departments[0]?.department_name ?? null);
  }
  return {
    user_id: employee.user_id,
    full_name: toFullName(employee),
    department_id: departmentId,
    department_name: departmentName,
    position: normalizeText(employee.user_position),
    date_hired:
      normalizeText(tracking?.date_hired_snapshot) ??
      normalizeText(employee.user_dateOfHire),
  };
}

export async function getEvaluationWorkspace(
  userId: number
): Promise<WorkspaceBundle> {
  const trackingBody: unknown = await dFetch(
    `/items/employee_evaluation_tracking?filter[user_id][_eq]=${userId}&limit=1`
  );
  const trackingRows = parseRowList(
    EvaluationTrackingSchema,
    trackingBody,
    "employee_evaluation_tracking"
  );
  const evaluationBody: unknown = await dFetch(
    `/items/employee_evaluation?filter[user_id][_eq]=${userId}&limit=-1`
  );
  const evaluations = parseRowList(
    EmployeeEvaluationSchema,
    evaluationBody,
    "employee_evaluation"
  );
  const evaluationIds = evaluations.map((evaluation) => evaluation.id);
  const evaluationItems =
    evaluationIds.length === 0
      ? []
      : parseRowList(
          EmployeeEvaluationItemSchema,
          await dFetch(
            `/items/employee_evaluation_item?filter[evaluation_id][_in]=${evaluationIds.join(",")}&limit=-1`
          ),
          "employee_evaluation_item"
        );
  const pipBody: unknown = await dFetch(
    `/items/employee_pip?filter[user_id][_eq]=${userId}&limit=-1`
  );
  const pips = parseRowList(EmployeePipSchema, pipBody, "employee_pip");
  const pipIds = pips.map((pip) => pip.id);
  const pipAreas =
    pipIds.length === 0
      ? []
      : parseRowList(
          EmployeePipAreaSchema,
          await dFetch(
            `/items/employee_pip_area?filter[pip_id][_in]=${pipIds.join(",")}&limit=-1`
          ),
          "employee_pip_area"
        );
  const pipActionPlans =
    pipIds.length === 0
      ? []
      : parseRowList(
          EmployeePipActionPlanSchema,
          await dFetch(
            `/items/employee_pip_action_plan?filter[pip_id][_in]=${pipIds.join(",")}&limit=-1`
          ),
          "employee_pip_action_plan"
        );
  const bundle = {
    employee: await resolveWorkspaceEmployee(
      userId,
      trackingRows[0] ?? null
    ),
    tracking: trackingRows[0] ?? null,
    evaluations,
    evaluationItems,
    pips,
    pipAreas,
    pipActionPlans,
  };
  const parsed = WorkspaceBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: workspace bundle contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
    );
  }
  return parsed.data;
}

export async function resolveEmployeeDepartmentId(
  userId: number
): Promise<number | null> {
  const body: unknown = await dFetch(
    `/items/user/${userId}?fields=user_department`
  );
  const row = unwrapData<unknown>(body);
  const source = Array.isArray(row) ? row[0] : row;
  if (source === null || source === undefined || typeof source !== "object") {
    return null;
  }
  return toDepartmentId(
    ((source as { user_department?: unknown }).user_department ?? null) as RosterEmployee["user_department"]
  );
}

export async function listKpiCriteria(
  departmentId: number,
  includeInactive = false
): Promise<EvaluationCriterion[]> {
  const query = [
    `filter[department_id][_eq]=${departmentId}`,
    "sort=sort_order,id",
    "limit=-1",
  ];
  if (!includeInactive) query.push("filter[is_active][_eq]=1");
  const body: unknown = await dFetch(
    `/items/evaluation_criteria?${query.join("&")}`
  );
  const rows = parseRowList(
    EvaluationCriterionSchema,
    body,
    "evaluation_criteria"
  );
  return rows
    .filter((row) => includeInactive || row.is_active)
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order || left.id - right.id
    );
}
