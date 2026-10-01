import { z } from "zod";

import type {
  EvaluationCriterion,
  RosterRow,
} from "../types/performance-evaluation.schema";
import {
  EvaluationCriterionSchema,
  RosterRowSchema,
} from "../types/performance-evaluation.schema";
import type {
  CreateKpiCriterionInput,
  ReorderInput,
  UpdateKpiCriterionInput,
} from "../types/performance-evaluation-api.schema";

export type EvaluationScope = "hr" | "head";

export class EvaluationClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "EvaluationClientError";
    this.status = status;
    this.code = code;
  }
}

const HR_BASE = "/api/hrm/performance-evaluation";
const ADMIN_BASE = "/api/hrm/performance-evaluation/admin-evaluation";
const HEAD_ROSTER_PATH = "/api/hrm/performance-evaluation/department-evaluation/roster";
const HEAD_WORKSPACE_PATH = "/api/hrm/performance-evaluation/department-evaluation/workspace";

const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const FailureEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
});

function toClientError(status: number, body: unknown): EvaluationClientError {
  const parsed = FailureEnvelopeSchema.safeParse(body);
  if (parsed.success) {
    return new EvaluationClientError(status, parsed.data.message, parsed.data.code);
  }
  return new EvaluationClientError(status, `Request failed with status ${status}.`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw toClientError(res.status, body);
  }
  const envelope = SuccessEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    throw toClientError(res.status, body);
  }
  return envelope.data.data as T;
}

async function requestParsed<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const data = await request<unknown>(path, init);
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new EvaluationClientError(500, "The server returned data in an unexpected shape.");
  }
  return parsed.data;
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function rosterPath(scope: EvaluationScope, includeRegular?: boolean): string {
  const base = scope === "hr" ? `${ADMIN_BASE}/roster` : HEAD_ROSTER_PATH;
  return includeRegular ? `${base}?include_regular=1` : base;
}

export async function getRoster(
  scope: EvaluationScope,
  opts?: { includeRegular?: boolean },
): Promise<RosterRow[]> {
  return requestParsed(rosterPath(scope, opts?.includeRegular), z.array(RosterRowSchema));
}

export function getWorkspacePath(scope: EvaluationScope): string {
  return scope === "hr" ? `${ADMIN_BASE}/workspace` : HEAD_WORKSPACE_PATH;
}

function kpiCriteriaQuery(includeInactive?: boolean, departmentId?: number): string {
  const params = new URLSearchParams();
  if (includeInactive) params.set("include_inactive", "1");
  if (departmentId !== undefined) params.set("department_id", String(departmentId));
  const query = params.toString();
  return query === "" ? `${HR_BASE}/evaluation-criteria` : `${HR_BASE}/evaluation-criteria?${query}`;
}

function kpiCriterionScopedPath(id: number, departmentId?: number): string {
  const base = `${HR_BASE}/evaluation-criteria/${id}`;
  return departmentId === undefined ? base : `${base}?department_id=${departmentId}`;
}

export async function listKpiCriteria(
  includeInactive?: boolean,
  departmentId?: number,
): Promise<EvaluationCriterion[]> {
  return requestParsed(kpiCriteriaQuery(includeInactive, departmentId), z.array(EvaluationCriterionSchema));
}

export async function createKpiCriterion(
  input: CreateKpiCriterionInput,
  departmentId?: number,
): Promise<EvaluationCriterion> {
  return requestParsed(kpiCriteriaQuery(false, departmentId), EvaluationCriterionSchema, jsonInit("POST", input));
}

export async function updateKpiCriterion(
  id: number,
  input: UpdateKpiCriterionInput,
  departmentId?: number,
): Promise<EvaluationCriterion> {
  return requestParsed(
    kpiCriterionScopedPath(id, departmentId),
    EvaluationCriterionSchema,
    jsonInit("PATCH", input),
  );
}

export async function deleteKpiCriterion(id: number, departmentId?: number): Promise<void> {
  await request<unknown>(kpiCriterionScopedPath(id, departmentId), { method: "DELETE" });
}

export async function reorderKpiCriteria(input: ReorderInput, departmentId?: number): Promise<EvaluationCriterion[]> {
  const base = `${HR_BASE}/evaluation-criteria/reorder`;
  const path = departmentId === undefined ? base : `${base}?department_id=${departmentId}`;
  return requestParsed(
    path,
    z.array(EvaluationCriterionSchema),
    jsonInit("POST", input),
  );
}

export type {
  CreateKpiCriterionInput,
  EvaluationCriterion,
  ReorderInput,
  RosterRow,
  UpdateKpiCriterionInput,
};
