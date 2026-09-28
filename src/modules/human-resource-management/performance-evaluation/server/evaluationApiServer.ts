import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, decodeJwtPayload, type JwtPayload } from "@/lib/auth-utils";

export { nowPH as phTimeNow } from "../utils/audit";

// evaluationApiServer.ts — shared boundary helpers for the performance-evaluation
// API routes. Session handling mirrors the onboarding signing boundary (same
// `vos_access_token` cookie, same `{success,message}` error envelope); the
// session is decoded for the audit actor only — no role gate lives here.

export const EVALUATION_ERROR_CODES = {
  rowExists: "EVALUATION_ROW_EXISTS",
  rowNotFound: "EVALUATION_ROW_NOT_FOUND",
  readFailed: "EVALUATION_READ_FAILED",
  writeFailed: "EVALUATION_WRITE_FAILED",
  criteriaNotConfigured: "EVALUATION_CRITERIA_NOT_CONFIGURED",
  criteriaWeightInvalid: "EVALUATION_CRITERIA_WEIGHT_INVALID",
} as const;

export type EvaluationErrorCode =
  (typeof EVALUATION_ERROR_CODES)[keyof typeof EVALUATION_ERROR_CODES];

/** Decoded `vos_access_token` payload, or null when absent/undecodable. */
export function readSession(req: NextRequest): JwtPayload | null {
  const viaCookies = req.cookies.get(COOKIE_NAME)?.value;
  if (viaCookies) return decodeJwtPayload(viaCookies);
  const token = tokenFromCookieHeader(req.headers.get("cookie"));
  return token ? decodeJwtPayload(token) : null;
}

function tokenFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      return value === "" ? null : value;
    }
  }
  return null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, message: "Unauthorized" },
    { status: 401 }
  );
}

export function validationFailed(
  details: Record<string, string[] | undefined>
): NextResponse {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors: details },
    { status: 400 }
  );
}

export function notFound(message = "Record not found"): NextResponse {
  return NextResponse.json({ success: false, message }, { status: 404 });
}

export function serverError(message?: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message:
        message ?? "An unexpected error occurred. Please try again later.",
    },
    { status: 500 }
  );
}

export function evaluationError(
  status: number,
  code: EvaluationErrorCode,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, code, message }, { status });
}

/** Typed success envelope `{ success: true, data }` (pass 201 on create). */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

interface DirectusErrorEnvelope {
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
}

function firstDirectusError(result: unknown) {
  const errors = (result as DirectusErrorEnvelope | null | undefined)?.errors;
  return Array.isArray(errors) ? errors[0] : undefined;
}

// A Directus item GET for an id the static token can see read on answers
// `{errors:[{extensions:{code:"FORBIDDEN"}}]}` when the row is absent (the
// probe in onboarding task 9 evidence confirmed 403 instead of 404). ANY
// other error body is a real backend failure and must not be silently
// reported as 404.
export function isAbsentItemError(result: unknown): boolean {
  return firstDirectusError(result)?.extensions?.code === "FORBIDDEN";
}

function failureText(source: unknown): string {
  if (source instanceof Error) return source.message;
  const first = firstDirectusError(source);
  return `${first?.extensions?.code ?? ""} ${first?.message ?? ""}`;
}

// dFetch never throws on non-2xx: it returns the parsed Directus error body.
// Map that body (or a thrown coded error) to the route's HTTP status so a
// failed write can never be reported as a misleading 201 with `data: null`.
export function mapWriteFailure(error: unknown): NextResponse {
  const text = failureText(error).toLowerCase();

  if (
    text.includes("record_not_unique") ||
    text.includes("duplicate entry")
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "A record with the same unique key already exists",
      },
      { status: 409 }
    );
  }
  if (
    text.includes("invalid_foreign_key") ||
    text.includes("foreign key constraint fails") ||
    text.includes("cannot add or update a child row")
  ) {
    return NextResponse.json(
      { success: false, message: "A referenced record does not exist" },
      { status: 400 }
    );
  }
  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    },
    { status: 500 }
  );
}

/** Append helper: one step past the current maximum `sort_order`. */
export function nextSortOrder(
  rows: readonly { sort_order: number }[]
): number {
  let max = 0;
  for (const row of rows) {
    if (row.sort_order > max) max = row.sort_order;
  }
  return max + 1;
}

/**
 * Pulls `.data` out of a Directus response body.
 * @throws Coded `EVALUATION_READ_FAILED` when the body carries `.errors`
 * or has an unexpected shape.
 */
export function unwrapData<T>(body: unknown): T {
  if (typeof body === "object" && body !== null && "errors" in body) {
    const errors = (body as DirectusErrorEnvelope).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(
        `${EVALUATION_ERROR_CODES.readFailed}: ${errors
          .map((entry) => entry.message ?? "unknown error")
          .join("; ")}`
      );
    }
  }
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: T }).data;
  }
  throw new Error(
    `${EVALUATION_ERROR_CODES.readFailed}: unexpected response shape (${JSON.stringify(
      body
    ).slice(0, 300)})`
  );
}
