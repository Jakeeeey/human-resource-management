import { z } from "zod";

import type {
  EmployeeEvaluation,
  EmployeeEvaluationItem,
  EmployeePip,
  EmployeePipActionPlan,
  EmployeePipArea,
  EvaluationCriterion,
  EvaluationTracking,
  PipCriterion,
  RosterRow,
  WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
  EmployeeEvaluationItemSchema,
  EmployeeEvaluationSchema,
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
  EvaluationCriterionSchema,
  EvaluationTrackingSchema,
  PipCriterionSchema,
  RosterRowSchema,
  WorkspaceBundleSchema,
} from "../types/performance-evaluation.schema";
import type {
  CreateEvaluationInput,
  CreateKpiCriterionInput,
  CreatePipAreaInput,
  CreatePipInput,
  ReorderInput,
  UpdateEvaluationInput,
  UpdateKpiCriterionInput,
  UpdatePipAreaInput,
  UpdatePipInput,
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
const HEAD_ROSTER_PATH = "/api/hrm/department-evaluation/roster";
const HEAD_WORKSPACE_PATH = "/api/hrm/department-evaluation/workspace";
const PIP_ACK_BASE = "/api/hrm/pip-acknowledgement";

const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const FailureEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
});

const EvaluationResultSchema = z.object({
  evaluation: EmployeeEvaluationSchema,
  items: z.array(EmployeeEvaluationItemSchema),
});

export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

const PipResultSchema = z.object({
  pip: EmployeePipSchema,
  areas: z.array(EmployeePipAreaSchema),
  actionPlans: z.array(EmployeePipActionPlanSchema),
});

export type PipResult = z.infer<typeof PipResultSchema>;

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
  const base = scope === "hr" ? `${HR_BASE}/roster` : HEAD_ROSTER_PATH;
  return includeRegular ? `${base}?include_regular=1` : base;
}

export async function getRoster(
  scope: EvaluationScope,
  opts?: { includeRegular?: boolean },
): Promise<RosterRow[]> {
  return requestParsed(rosterPath(scope, opts?.includeRegular), z.array(RosterRowSchema));
}

export async function getWorkspace(scope: EvaluationScope, userId: number): Promise<WorkspaceBundle> {
  const base = scope === "hr" ? `${HR_BASE}/workspace` : HEAD_WORKSPACE_PATH;
  return requestParsed(`${base}?user_id=${userId}`, WorkspaceBundleSchema);
}

export async function listKpiCriteria(includeInactive?: boolean): Promise<EvaluationCriterion[]> {
  const path = includeInactive ? `${HR_BASE}/kpi-criteria?include_inactive=1` : `${HR_BASE}/kpi-criteria`;
  return requestParsed(path, z.array(EvaluationCriterionSchema));
}

export async function createKpiCriterion(input: CreateKpiCriterionInput): Promise<EvaluationCriterion> {
  return requestParsed(`${HR_BASE}/kpi-criteria`, EvaluationCriterionSchema, jsonInit("POST", input));
}

export async function updateKpiCriterion(
  id: number,
  input: UpdateKpiCriterionInput,
): Promise<EvaluationCriterion> {
  return requestParsed(
    `${HR_BASE}/kpi-criteria/${id}`,
    EvaluationCriterionSchema,
    jsonInit("PATCH", input),
  );
}

export async function deleteKpiCriterion(id: number): Promise<void> {
  await request<unknown>(`${HR_BASE}/kpi-criteria/${id}`, { method: "DELETE" });
}

export async function reorderKpiCriteria(input: ReorderInput): Promise<EvaluationCriterion[]> {
  return requestParsed(
    `${HR_BASE}/kpi-criteria/reorder`,
    z.array(EvaluationCriterionSchema),
    jsonInit("POST", input),
  );
}

export async function listPipAreas(includeInactive?: boolean): Promise<PipCriterion[]> {
  const path = includeInactive ? `${HR_BASE}/pip-areas?include_inactive=1` : `${HR_BASE}/pip-areas`;
  return requestParsed(path, z.array(PipCriterionSchema));
}

export async function createPipArea(input: CreatePipAreaInput): Promise<PipCriterion> {
  return requestParsed(`${HR_BASE}/pip-areas`, PipCriterionSchema, jsonInit("POST", input));
}

export async function updatePipArea(id: number, input: UpdatePipAreaInput): Promise<PipCriterion> {
  return requestParsed(`${HR_BASE}/pip-areas/${id}`, PipCriterionSchema, jsonInit("PATCH", input));
}

export async function deletePipArea(id: number): Promise<void> {
  await request<unknown>(`${HR_BASE}/pip-areas/${id}`, { method: "DELETE" });
}

export async function reorderPipAreas(input: ReorderInput): Promise<PipCriterion[]> {
  return requestParsed(
    `${HR_BASE}/pip-areas/reorder`,
    z.array(PipCriterionSchema),
    jsonInit("POST", input),
  );
}

export async function createEvaluation(input: CreateEvaluationInput): Promise<EvaluationResult> {
  return requestParsed(`${HR_BASE}/evaluations`, EvaluationResultSchema, jsonInit("POST", input));
}

export async function updateEvaluation(
  id: number,
  input: UpdateEvaluationInput,
): Promise<EvaluationResult> {
  return requestParsed(
    `${HR_BASE}/evaluations/${id}`,
    EvaluationResultSchema,
    jsonInit("PATCH", input),
  );
}

export async function voidEvaluation(id: number, voidReason: string): Promise<EmployeeEvaluation> {
  return requestParsed(
    `${HR_BASE}/evaluations/${id}/void`,
    EmployeeEvaluationSchema,
    jsonInit("POST", { void_reason: voidReason }),
  );
}

export async function createPip(input: CreatePipInput): Promise<PipResult> {
  return requestParsed(`${HR_BASE}/pips`, PipResultSchema, jsonInit("POST", input));
}

export async function updatePip(id: number, input: UpdatePipInput): Promise<PipResult> {
  return requestParsed(`${HR_BASE}/pips/${id}`, PipResultSchema, jsonInit("PATCH", input));
}

export async function issueRecommendation(userId: number): Promise<EvaluationTracking> {
  return requestParsed(
    `${HR_BASE}/tracking/${userId}/recommendation`,
    EvaluationTrackingSchema,
    { method: "POST" },
  );
}

export async function regularize(userId: number): Promise<EvaluationTracking> {
  return requestParsed(
    `${HR_BASE}/tracking/${userId}/regularize`,
    EvaluationTrackingSchema,
    { method: "POST" },
  );
}

export async function getMyPips(): Promise<EmployeePip[]> {
  return requestParsed(`${PIP_ACK_BASE}/my-pips`, z.array(EmployeePipSchema));
}

export async function getMyPip(pipId: number): Promise<PipResult> {
  return requestParsed(`${PIP_ACK_BASE}/${pipId}`, PipResultSchema);
}

export async function markPipViewed(pipId: number): Promise<EmployeePip> {
  return requestParsed(`${PIP_ACK_BASE}/${pipId}/view`, EmployeePipSchema, { method: "POST" });
}

export async function acknowledgePip(pipId: number): Promise<EmployeePip> {
  return requestParsed(
    `${PIP_ACK_BASE}/${pipId}/acknowledge`,
    EmployeePipSchema,
    jsonInit("POST", {}),
  );
}

export type {
  CreateEvaluationInput,
  CreateKpiCriterionInput,
  CreatePipAreaInput,
  CreatePipInput,
  EmployeeEvaluation,
  EmployeeEvaluationItem,
  EmployeePip,
  EmployeePipActionPlan,
  EmployeePipArea,
  EvaluationCriterion,
  EvaluationTracking,
  PipCriterion,
  ReorderInput,
  RosterRow,
  UpdateEvaluationInput,
  UpdateKpiCriterionInput,
  UpdatePipAreaInput,
  UpdatePipInput,
  WorkspaceBundle,
};
