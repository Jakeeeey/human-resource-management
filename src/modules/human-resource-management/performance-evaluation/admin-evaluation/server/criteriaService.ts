import { z } from "zod";

import { dFetch } from "../utils/directus";

import {
  EvaluationCriterionSchema,
  type EvaluationCriterion,
} from "../types/performance-evaluation.schema";
import {
  EVALUATION_ERROR_CODES,
  unwrapData,
} from "./evaluationApiServer";

type DepartmentValue =
  | number
  | string
  | { department_id: number }
  | null
  | undefined;

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

function toDepartmentId(value: DepartmentValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return value.department_id > 0 ? value.department_id : null;
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
    ((source as { user_department?: unknown }).user_department ?? null) as DepartmentValue
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
