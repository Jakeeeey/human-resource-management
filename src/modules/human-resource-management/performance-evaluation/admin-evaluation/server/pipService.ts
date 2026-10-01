import { dFetch } from "../utils/directus";

import {
  EmployeeEvaluationSchema,
  EmployeePipActionPlanSchema,
  EmployeePipSchema,
  EvaluationTrackingSchema,
  type EmployeeEvaluation,
  type EmployeePip,
  type EmployeePipActionPlan,
  type EvaluationTracking,
} from "../types/performance-evaluation.schema";
import {
  canRecordOutcome,
  incompleteOutcomeIndices,
  isPlanEditable,
  reviewDateInRange,
  type PipGuardFacts,
} from "../utils/pipGuards";
import {
  EVALUATION_ERROR_CODES,
  isAbsentItemError,
  unwrapData,
} from "./evaluationApiServer";
import type {
  UpdatePipActionPlanItem,
} from "../types/performance-evaluation-api.schema";

export const PIP_ERROR_CODES = {
  resultPremature: "PIP_RESULT_PREMATURE",
  statusPremature: "PIP_STATUS_PREMATURE",
  parentVoided: "PIP_PARENT_VOIDED",
  parentInvalid: "PIP_PARENT_INVALID",
  alreadyExists: "PIP_ALREADY_EXISTS",
  employeeClosed: "PIP_EMPLOYEE_CLOSED",
  planIncomplete: "PIP_PLAN_INCOMPLETE",
  dateIncoherent: "PIP_DATE_INCOHERENT",
  notAcknowledged: "PIP_NOT_ACKNOWLEDGED",
  alreadyClosed: "PIP_ALREADY_CLOSED",
  incompleteResults: "PIP_INCOMPLETE_RESULTS",
  planFrozenAfterAck: "PIP_PLAN_FROZEN_AFTER_ACK",
  mixedIntent: "PIP_MIXED_INTENT",
  outcomeRowMismatch: "PIP_OUTCOME_ROW_MISMATCH",
} as const;

export class PipGateError extends Error {
  readonly status: number;
  readonly code: string;
  readonly indices: number[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    indices?: number[]
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.indices = indices;
  }
}

export function pipGate(
  status: number,
  code: string,
  message: string,
  indices?: number[]
): PipGateError {
  return new PipGateError(status, code, message, indices);
}

export function pipGuardFacts(
  pip: Pick<EmployeePip, "status" | "employee_acknowledged_at">
): PipGuardFacts {
  return {
    status: pip.status,
    employeeAcknowledgedAt: pip.employee_acknowledged_at,
  };
}

export function assertCanRecordOutcome(
  pip: Pick<EmployeePip, "status" | "employee_acknowledged_at">
): void {
  if (pip.status !== "open") {
    throw pipGate(
      409,
      PIP_ERROR_CODES.alreadyClosed,
      "The PIP is already closed"
    );
  }
  if (!canRecordOutcome(pipGuardFacts(pip))) {
    throw pipGate(
      403,
      PIP_ERROR_CODES.notAcknowledged,
      "The PIP must be acknowledged by the employee before results can be recorded"
    );
  }
}

export function assertPlanEditable(
  pip: Pick<EmployeePip, "status" | "employee_acknowledged_at">
): void {
  if (pip.status !== "open") {
    throw pipGate(
      409,
      PIP_ERROR_CODES.alreadyClosed,
      "The PIP is already closed"
    );
  }
  if (!isPlanEditable(pipGuardFacts(pip))) {
    throw pipGate(
      409,
      PIP_ERROR_CODES.planFrozenAfterAck,
      "The plan is frozen after employee acknowledgement"
    );
  }
}

export type PipPatchIntent = "outcome" | "plan" | "mixed" | "empty";

const OUTCOME_ITEM_KEYS = ["id", "review_date", "result"] as const;
const PLAN_ITEM_KEYS = ["pip_area_id", "area", "action"] as const;
const PLAN_HEADER_KEYS = [
  "pip_start_date",
  "pip_end_date",
  "immediate_superior_id",
  "detailed_concerns",
] as const;

function payloadHasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function itemTouchesKeys(item: unknown, keys: readonly string[]): boolean {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;
  return keys.some((key) => payloadHasKey(record, key));
}

export function decidePipPatchIntent(body: unknown): PipPatchIntent {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return "empty";
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length === 0) return "empty";
  const outcomeTop = payloadHasKey(record, "status");
  const planTop = PLAN_HEADER_KEYS.some((key) => payloadHasKey(record, key));
  let outcomeItem = false;
  let planItem = false;
  let emptyPlanArray = false;
  if (payloadHasKey(record, "action_plan")) {
    const items = record.action_plan;
    if (Array.isArray(items)) {
      if (items.length === 0) emptyPlanArray = true;
      for (const item of items) {
        if (itemTouchesKeys(item, OUTCOME_ITEM_KEYS)) outcomeItem = true;
        if (itemTouchesKeys(item, PLAN_ITEM_KEYS)) planItem = true;
      }
    }
  }
  const outcome = outcomeTop || outcomeItem;
  const plan = planTop || planItem || emptyPlanArray;
  if (outcome && plan) return "mixed";
  if (outcome) return "outcome";
  if (plan) return "plan";
  return "empty";
}

export function pipDatesCoherent(
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  if (start === null || start === undefined) return true;
  if (end === null || end === undefined) return true;
  if (start.trim() === "" || end.trim() === "") return true;
  return end.slice(0, 10) >= start.slice(0, 10);
}

export function assertPipDatesCoherent(
  start: string | null | undefined,
  end: string | null | undefined
): void {
  if (!pipDatesCoherent(start, end)) {
    throw pipGate(
      422,
      PIP_ERROR_CODES.dateIncoherent,
      "The PIP end date must not be earlier than the start date"
    );
  }
}

export function distinctPipAreas(items: readonly { area: string }[]): string[] {
  const seen = new Set<string>();
  const areas: string[] = [];
  for (const item of items) {
    const area = item.area.trim();
    if (area !== "" && !seen.has(area)) {
      seen.add(area);
      areas.push(area);
    }
  }
  return areas;
}

export async function fetchEvaluationById(
  evaluationId: number
): Promise<EmployeeEvaluation | null> {
  const result = (await dFetch(
    `/items/employee_evaluation/${evaluationId}`
  )) as { data?: unknown; errors?: unknown };
  if (result?.errors || result?.data === null || result?.data === undefined) {
    if (isAbsentItemError(result)) return null;
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_evaluation read failed (${JSON.stringify(result).slice(0, 300)})`
    );
  }
  const parsed = EmployeeEvaluationSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_evaluation row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
    );
  }
  return parsed.data;
}

export async function fetchLiveFailedEvaluation(
  evaluationId: number
): Promise<EmployeeEvaluation> {
  const evaluation = await fetchEvaluationById(evaluationId);
  if (evaluation === null || evaluation.result !== "failed") {
    throw pipGate(
      422,
      PIP_ERROR_CODES.parentInvalid,
      "A PIP follows a failed evaluation"
    );
  }
  if (evaluation.voided_at !== null) {
    throw pipGate(
      409,
      PIP_ERROR_CODES.parentVoided,
      "A PIP cannot reference a voided evaluation"
    );
  }
  return evaluation;
}

export async function fetchTrackingByUserId(
  userId: number
): Promise<EvaluationTracking | null> {
  const body: unknown = await dFetch(
    `/items/employee_evaluation_tracking?filter[user_id][_eq]=${userId}&limit=1`
  );
  const rows = unwrapData<unknown>(body);
  const first = Array.isArray(rows) ? rows[0] : undefined;
  if (first === undefined) return null;
  const parsed = EvaluationTrackingSchema.safeParse(first);
  if (!parsed.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_evaluation_tracking row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
    );
  }
  return parsed.data;
}

export function assertEmployeeOpen(
  tracking: EvaluationTracking | null
): void {
  if (
    tracking !== null &&
    (tracking.terminated_at !== null || tracking.regularized_at !== null)
  ) {
    throw pipGate(
      409,
      PIP_ERROR_CODES.employeeClosed,
      "The employee record is already closed"
    );
  }
}

export async function assertNoExistingPip(
  evaluationId: number
): Promise<void> {
  const body: unknown = await dFetch(
    `/items/employee_pip?filter[evaluation_id][_eq]=${evaluationId}&fields=id&limit=1`
  );
  const rows = unwrapData<unknown>(body);
  if (Array.isArray(rows) && rows.length > 0) {
    throw pipGate(
      409,
      PIP_ERROR_CODES.alreadyExists,
      "A PIP already exists for this evaluation"
    );
  }
}

export async function assertNoExistingPipForUser(
  userId: number
): Promise<void> {
  const body: unknown = await dFetch(
    `/items/employee_pip?filter[user_id][_eq]=${userId}&fields=id&limit=1`
  );
  const rows = unwrapData<unknown>(body);
  if (Array.isArray(rows) && rows.length > 0) {
    throw pipGate(
      409,
      PIP_ERROR_CODES.alreadyExists,
      "Only one PIP is allowed per employee for the whole probation"
    );
  }
}

export async function fetchPipRow(pipId: number): Promise<EmployeePip | null> {
  const result = (await dFetch(`/items/employee_pip/${pipId}`)) as {
    data?: unknown;
    errors?: unknown;
  };
  if (result?.errors || result?.data === null || result?.data === undefined) {
    if (isAbsentItemError(result)) return null;
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_pip read failed (${JSON.stringify(result).slice(0, 300)})`
    );
  }
  const parsed = EmployeePipSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_pip row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
    );
  }
  return parsed.data;
}

export async function fetchPipPlans(
  pipId: number
): Promise<EmployeePipActionPlan[]> {
  const body: unknown = await dFetch(
    `/items/employee_pip_action_plan?filter[pip_id][_eq]=${pipId}&limit=-1&sort=sort_order,id`
  );
  const rows = unwrapData<unknown>(body);
  if (!Array.isArray(rows)) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: employee_pip_action_plan read failed (${JSON.stringify(body).slice(0, 300)})`
    );
  }
  return rows.map((row) => {
    const parsed = EmployeePipActionPlanSchema.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `${EVALUATION_ERROR_CODES.readFailed}: employee_pip_action_plan row contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
      );
    }
    return parsed.data;
  });
}

export interface PipOutcomeWrite {
  id: number;
  review_date: string | null;
  result: string | null;
}

function overlayOutcomeValue(
  overlay: UpdatePipActionPlanItem,
  key: "review_date" | "result",
  stored: string | null
): string | null {
  if (!payloadHasKey(overlay as Record<string, unknown>, key)) return stored;
  const value = overlay[key];
  return (value ?? null) as string | null;
}

export function buildOutcomeWrites(
  stored: readonly EmployeePipActionPlan[],
  input: readonly UpdatePipActionPlanItem[]
): PipOutcomeWrite[] {
  const withId = input.filter((item) => item.id !== undefined);
  if (withId.length > 0) {
    const byId = new Map<number, UpdatePipActionPlanItem>();
    for (const item of withId) {
      if (item.id !== undefined) byId.set(item.id, item);
    }
    const writes: PipOutcomeWrite[] = [];
    for (const row of stored) {
      const overlay = byId.get(row.id);
      if (overlay === undefined) continue;
      writes.push({
        id: row.id,
        review_date: overlayOutcomeValue(overlay, "review_date", row.review_date),
        result: overlayOutcomeValue(overlay, "result", row.result),
      });
    }
    return writes;
  }
  if (input.length !== stored.length) {
    throw pipGate(
      422,
      PIP_ERROR_CODES.outcomeRowMismatch,
      "Outcome rows must align with the agreed plan rows"
    );
  }
  return stored.map((row, index) => {
    const overlay = input[index];
    return {
      id: row.id,
      review_date: overlayOutcomeValue(overlay, "review_date", row.review_date),
      result: overlayOutcomeValue(overlay, "result", row.result),
    };
  });
}

export function mergedOutcomeRows(
  stored: readonly EmployeePipActionPlan[],
  writes: readonly PipOutcomeWrite[]
): { reviewDate: string | null; result: string | null }[] {
  const byId = new Map<number, PipOutcomeWrite>();
  for (const write of writes) byId.set(write.id, write);
  return stored.map((row) => {
    const write = byId.get(row.id);
    if (write === undefined) {
      return { reviewDate: row.review_date, result: row.result };
    }
    return { reviewDate: write.review_date, result: write.result };
  });
}

export function assertOutcomeCompleteForFinalize(
  rows: readonly { reviewDate: string | null; result: string | null }[]
): void {
  const missing = incompleteOutcomeIndices(rows);
  if (missing.length > 0) {
    throw pipGate(
      422,
      PIP_ERROR_CODES.incompleteResults,
      "Every plan row needs a review date and a result before closing the PIP",
      missing
    );
  }
}

export function assertReviewDatesInRange(
  rows: readonly { review_date: string | null }[],
  start: string | null,
  end: string | null
): void {
  for (const row of rows) {
    if (!reviewDateInRange(row.review_date, start, end)) {
      throw pipGate(
        422,
        PIP_ERROR_CODES.dateIncoherent,
        "A review date falls outside the PIP period"
      );
    }
  }
}
