import { z } from "zod";

import { dFetch } from "../utils/directus";

import {
  EmployeeEvaluationSchema,
  EmployeePipSchema,
  EvaluationTrackingSchema,
  RosterRowSchema,
  type EmployeeEvaluation,
  type EmployeePip,
  type EvaluationTracking,
  type RosterRow,
} from "../types/performance-evaluation.schema";
import {
  EVALUATION_ERROR_CODES,
  unwrapData,
} from "./evaluationApiServer";
import type { EvaluationCapability } from "./evaluationCapability";
import { computeDueDates, isDateOverdue } from "../utils/probationClock";
import {
  countFailures,
  deriveNextAction,
  deriveProbationStatus,
  deriveStage,
  isSubjectToTermination,
  type EvalType,
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
  company_id: z.union([z.number().int(), z.string().regex(/^\d+$/)]).nullish(),
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
  subject_to_termination: 3,
  regular: 4,
  terminated: 5,
};

export { countFailures, isSubjectToTermination };

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
  const evalTypeById = new Map<number, EvalType>();
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
      acknowledgedAt: pip.employee_acknowledged_at,
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

export interface DepartmentSuperior {
  user_id: number;
  full_name: string;
  position: string | null;
  is_department_head: boolean;
}

const DepartmentHeadIdSchema = z.object({
  department_id: z.number().int(),
  department_head_id: z
    .union([z.number().int(), z.string().regex(/^\d+$/)])
    .nullish(),
});

const SUPERIOR_FIELDS =
  "user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire,isDeleted";

export async function listDepartmentSuperiors(
  userId: number
): Promise<DepartmentSuperior[]> {
  const userBody = await dFetch(
    `/items/user/${userId}?fields=${SUPERIOR_FIELDS}`
  );
  const userRow = RosterEmployeeSchema.safeParse(unwrapData(userBody));
  if (!userRow.success) return [];
  const departmentId = toDepartmentId(userRow.data.user_department);
  if (departmentId === null) return [];

  const [memberBody, departmentBody] = await Promise.all([
    dFetch(
      `/items/user?filter[user_department][_eq]=${departmentId}&fields=${SUPERIOR_FIELDS}&limit=-1`
    ),
    dFetch(
      `/items/department/${departmentId}?fields=department_id,department_head_id`
    ),
  ]);

  const members = parseRowList(RosterEmployeeSchema, memberBody, "user");
  const department = DepartmentHeadIdSchema.safeParse(unwrapData(departmentBody));
  const headId =
    department.success && department.data.department_head_id != null
      ? Number(department.data.department_head_id)
      : null;

  const superiors = new Map<number, DepartmentSuperior>();
  for (const member of members) {
    if (member.user_id === userId) continue;
    if (isDeletedValue(member.isDeleted ?? member.is_deleted ?? member.deleted)) {
      continue;
    }
    superiors.set(member.user_id, {
      user_id: member.user_id,
      full_name: toFullName(member),
      position: normalizeText(member.user_position),
      is_department_head: member.user_id === headId,
    });
  }

  if (headId !== null && headId !== userId && !superiors.has(headId)) {
    const headBody = await dFetch(
      `/items/user/${headId}?fields=${SUPERIOR_FIELDS}`
    ).catch(() => null);
    if (headBody !== null) {
      const headRow = RosterEmployeeSchema.safeParse(unwrapData(headBody));
      if (
        headRow.success &&
        !isDeletedValue(
          headRow.data.isDeleted ??
            headRow.data.is_deleted ??
            headRow.data.deleted
        )
      ) {
        superiors.set(headId, {
          user_id: headId,
          full_name: toFullName(headRow.data),
          position: normalizeText(headRow.data.user_position),
          is_department_head: true,
        });
      }
    }
  }

  return [...superiors.values()].sort((left, right) =>
    left.full_name.localeCompare(right.full_name)
  );
}

export async function listEvaluationRoster(
  cap: EvaluationCapability,
  opts?: { includeRegular?: boolean; scopeDepartmentIds?: number[] }
): Promise<RosterRow[]> {
  const [employeeBody, departmentBody, trackingBody, evaluationBody, pipBody] =
    await Promise.all([
      dFetch(
        "/items/user?fields=user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire,company_id,isDeleted&limit=-1"
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
    const day30Due = dueDates?.day30 ?? null;
    const day60Due = dueDates?.day60 ?? null;
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
      day_30_due: day30Due,
      day_60_due: day60Due,
      day_90_due: dueDates?.day90 ?? null,
      sixth_month_due: dueDates?.sixth ?? null,
      probation_status: probationStatus,
      stage,
      next_action: deriveNextAction(facts),
      is_overdue:
        (stage === "first_evaluation" && isDateOverdue(day30Due)) ||
        (stage === "second_evaluation" && isDateOverdue(day60Due)),
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
