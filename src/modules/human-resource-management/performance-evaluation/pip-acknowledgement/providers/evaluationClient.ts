import { z } from "zod";

import type {
  EmployeePip,
  EmployeePipActionPlan,
  EmployeePipArea,
} from "../types/performance-evaluation.schema";
import {
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
} from "../types/performance-evaluation.schema";

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

const PIP_ACK_BASE = "/api/hrm/performance-evaluation/pip-acknowledgement";

const SuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

const FailureEnvelopeSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
});

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
  EmployeePip,
  EmployeePipActionPlan,
  EmployeePipArea,
};
