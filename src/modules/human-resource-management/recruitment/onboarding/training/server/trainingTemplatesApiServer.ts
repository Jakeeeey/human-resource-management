import { NextResponse, type NextRequest } from "next/server";

import {
  readOnboardingTaskSession,
  sessionActorId,
} from "../../tasks/server/onboardingTaskApiServer";
import { TRAINING_CATALOG_ERROR_CODES } from "./trainingCatalogIo";

// trainingTemplatesApiServer.ts — boundary helpers for the training-templates
// admin API (templates + their nested items). The session is decoded for the
// AUDIT ACTOR only — no role gate lives here (access is governed outside the
// app by the platform module authorization). Every failure answers the house
// `{success, code, message}` envelope, and the catalog's coded IO/service
// failures map to HTTP statuses (mirrors
// requirementsApiServer.mapRequirementsFailure: duplicate -> 409, not-found ->
// 404, anything else -> 500).

export const TRAINING_TEMPLATES_ERROR_CODES = {
  invalidId: "TRAINING_TEMPLATES_INVALID_ID",
  unauthorized: "TRAINING_TEMPLATES_UNAUTHORIZED",
  validationFailed: "TRAINING_TEMPLATES_VALIDATION_FAILED",
  serverError: "TRAINING_TEMPLATES_SERVER_ERROR",
} as const;

export type TrainingTemplatesErrorCode =
  | (typeof TRAINING_TEMPLATES_ERROR_CODES)[keyof typeof TRAINING_TEMPLATES_ERROR_CODES]
  | (typeof TRAINING_CATALOG_ERROR_CODES)[keyof typeof TRAINING_CATALOG_ERROR_CODES];

export type TrainingTemplatesSessionVerdict =
  | { ok: true; actorId: number | null }
  | { ok: false };

/** Session read for audit attribution only — never an authorization branch. */
export function readTrainingTemplatesSession(
  req: NextRequest
): TrainingTemplatesSessionVerdict {
  const session = readOnboardingTaskSession(req);
  if (!session) return { ok: false };
  return { ok: true, actorId: sessionActorId(session) };
}

/** `?all=1` includes deactivated rows; the default list is active only. */
export function readAllFlag(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get("all") === "1";
}

export function trainingTemplatesError(
  status: number,
  code: TrainingTemplatesErrorCode,
  message: string
): NextResponse {
  return NextResponse.json({ success: false, code, message }, { status });
}

export function invalidId(): NextResponse {
  return trainingTemplatesError(
    400,
    TRAINING_TEMPLATES_ERROR_CODES.invalidId,
    "Invalid id"
  );
}

export function unauthorized(): NextResponse {
  return trainingTemplatesError(
    401,
    TRAINING_TEMPLATES_ERROR_CODES.unauthorized,
    "Unauthorized"
  );
}

export function validationFailed(
  errors: Record<string, string[] | undefined>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code: TRAINING_TEMPLATES_ERROR_CODES.validationFailed,
      message: "Validation failed",
      errors,
    },
    { status: 400 }
  );
}

/** 404 for an item id that does not belong to the template in the path. */
export function trainingItemNotFound(): NextResponse {
  return trainingTemplatesError(
    404,
    TRAINING_CATALOG_ERROR_CODES.itemNotFound,
    "Training item not found"
  );
}

/** Maps coded service/IO failures to the route HTTP envelope; unknown → 500. */
export function mapTrainingCatalogFailure(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes(TRAINING_CATALOG_ERROR_CODES.templateNotFound)) {
    return trainingTemplatesError(
      404,
      TRAINING_CATALOG_ERROR_CODES.templateNotFound,
      "Training template not found"
    );
  }
  if (message.includes(TRAINING_CATALOG_ERROR_CODES.itemNotFound)) {
    return trainingTemplatesError(
      404,
      TRAINING_CATALOG_ERROR_CODES.itemNotFound,
      "Training item not found"
    );
  }
  if (
    message.includes(TRAINING_CATALOG_ERROR_CODES.codeDuplicate) ||
    message.includes("RECORD_NOT_UNIQUE") ||
    message.toLowerCase().includes("duplicate entry")
  ) {
    return trainingTemplatesError(
      409,
      TRAINING_CATALOG_ERROR_CODES.codeDuplicate,
      "A row with the same code already exists"
    );
  }
  return trainingTemplatesError(
    500,
    TRAINING_TEMPLATES_ERROR_CODES.serverError,
    "An unexpected error occurred. Please try again later."
  );
}
