import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_NAME, decodeJwtPayload, type JwtPayload } from "@/lib/auth-utils";

// signingApiServer.ts — boundary helpers shared by the applicant-scoped
// signing API routes (todo 9: signing-envelope / job-offer / paperworks /
// paperwork-item). Every route runs server-side only: the Directus static
// token stays inside `dFetch` on the server and is never sent to the
// browser. The session gate decodes the same `vos_access_token` payload the
// other `/api/hrm/*` proxies use (signature verification is out of scope
// here, matching the existing convention) and answers 401 before any read
// or write.

export function getPhilippineTime(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

export function readSigningSession(req: NextRequest): JwtPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? decodeJwtPayload(token) : null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { success: false, message: "Unauthorized" },
    { status: 401 }
  );
}

export function validationFailed(
  errors: Record<string, string[] | undefined>
): NextResponse {
  return NextResponse.json(
    { success: false, message: "Validation failed", errors },
    { status: 400 }
  );
}

export function notFound(message: string): NextResponse {
  return NextResponse.json(
    { success: false, message },
    { status: 404 }
  );
}

export function serverError(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    },
    { status: 500 }
  );
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
// probe in task 9 evidence confirmed 403 instead of 404). ANY other error
// body is a real backend failure and must not be silently reported as 404.
export function isAbsentItemError(result: unknown): boolean {
  return firstDirectusError(result)?.extensions?.code === "FORBIDDEN";
}

// dFetch never throws on non-2xx: it returns the parsed Directus error body.
// Map that body to the route's HTTP status so a failed write can never be
// reported as a misleading 201 with `data: null`.
export function mapWriteFailure(result: unknown): {
  status: number;
  message: string;
} {
  const first = firstDirectusError(result);
  const text = `${first?.extensions?.code ?? ""} ${first?.message ?? ""}`.toLowerCase();

  if (text.includes("record_not_unique") || text.includes("duplicate entry")) {
    return {
      status: 409,
      message: "A record with the same unique key already exists",
    };
  }
  if (
    text.includes("invalid_foreign_key") ||
    text.includes("foreign key constraint fails") ||
    text.includes("cannot add or update a child row")
  ) {
    return {
      status: 400,
      message: "A referenced record does not exist",
    };
  }
  return {
    status: 500,
    message: "An unexpected error occurred. Please try again later.",
  };
}
