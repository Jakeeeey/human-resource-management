import { z } from "zod";

import { dFetch } from "@/modules/human-resource-management/shared/utils/directus";
import {
  HIRE_ORCHESTRATOR_ERROR_CODES,
  HireApplicantRowSchema,
  HireApplicationRowSchema,
  type HireApplicantRow,
  type HireApplicationRow,
} from "../types/hire.schema";
import { philippineDate } from "./hire-time";
import type { SpringUserCreatePayload } from "@/modules/human-resource-management/shared/services/spring-user-service";

// hire-application.ts — Directus reads + Spring payload mapping for the
// post-hire orchestrator. The application row is the prefill source (todo-4
// contract: applicant and application are 1:1 but decoupled, so ALL personal
// hire data comes from the application).

function directusErrorMessage(body: unknown): string | null {
  const parsed = z
    .object({ errors: z.array(z.object({ message: z.string() })).min(1) })
    .safeParse(body);
  if (!parsed.success) return null;
  return parsed.data.errors.map((error) => error.message).join("; ");
}

function unwrapData(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return undefined;
}

/**
 * Reads one applicant row (identity + current status) by id.
 * @param applicantId - Applicant row id.
 * @returns The parsed row, or null when Directus does not return one.
 * @throws Error with `HIRE_ORCHESTRATOR_ERROR_CODES.readFailed` when Directus
 * answers with an error body.
 */
export async function readHireApplicant(
  applicantId: number
): Promise<HireApplicantRow | null> {
  const body: unknown = await dFetch(
    `/items/applicant/${applicantId}?fields=id,full_name,position_applied_for,status`
  );
  const errorMessage = directusErrorMessage(body);
  if (errorMessage) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: applicant ${applicantId} could not be read (${errorMessage})`
    );
  }
  const parsed = HireApplicantRowSchema.safeParse(unwrapData(body));
  return parsed.success ? parsed.data : null;
}

/**
 * Reads the applicant's linked `application` row (1:1 via `applicant_id`).
 * An Directus error body is a READ FAILURE, never an empty result — todo 6
 * proved that swallowing a 403 filter error produced a false-empty list.
 * @param applicantId - Applicant row id.
 * @returns The parsed application row, or null when none exists.
 * @throws Error with `HIRE_ORCHESTRATOR_ERROR_CODES.readFailed` when Directus
 * answers with an error body.
 */
export async function readHireApplicationByApplicant(
  applicantId: number
): Promise<HireApplicationRow | null> {
  const fields = [
    "id",
    "applicant_id",
    "first_name",
    "middle_name",
    "last_name",
    "nickname",
    "email",
    "phone",
    "address",
    "position_applied_for",
    "birthdate",
    "sex",
    "civil_status",
    "religion",
    "sss_no",
    "tin",
    "philhealth_no",
    "pagibig_no",
  ].join(",");
  const body: unknown = await dFetch(
    `/items/application?filter[applicant_id][_eq]=${applicantId}&fields=${fields}&sort=id&limit=1`
  );
  const errorMessage = directusErrorMessage(body);
  if (errorMessage) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: application for applicant ${applicantId} could not be read (${errorMessage})`
    );
  }
  const data = unwrapData(body);
  if (!Array.isArray(data) || data.length === 0) return null;
  const parsed = HireApplicationRowSchema.safeParse(data[0]);
  return parsed.success ? parsed.data : null;
}

/**
 * @param application - Linked application row.
 * @returns The trimmed applicant email, or null when absent.
 */
export function resolveHireEmail(
  application: HireApplicationRow
): string | null {
  const email = application.email?.trim();
  return email ? email : null;
}

/**
 * @param application - Linked application row.
 * @param applicant - Applicant row (position fallback lives on applicant too).
 * @returns The trimmed job position, or null when neither row carries one.
 */
export function resolveHirePosition(
  application: HireApplicationRow,
  applicant: HireApplicantRow
): string | null {
  const position =
    application.position_applied_for?.trim() ||
    applicant.position_applied_for?.trim();
  return position ? position : null;
}

/**
 * Generates the initial employee password (never surfaced in logs/evidence).
 * @returns A random string satisfying the Spring password rules
 * (>=8 chars, lowercase + uppercase + digit + special).
 */
function generateHirePassword(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `Hrm#${hex}Aa1`;
}

/**
 * Maps the application row to the Spring `/users/create` payload. The
 * application's free-text `address` is NOT split into
 * province/city/brgy (guessing would corrupt data) — HR completes the
 * address in the master list; Spring accepts empty strings (live-proven).
 * @param application - Linked application row (email + position pre-validated).
 * @param applicant - Applicant row (name fallback).
 * @param position - Resolved position string.
 * @returns The payload consumed by `createSpringUser`.
 */
export function buildSpringUserPayload(
  application: HireApplicationRow,
  applicant: HireApplicantRow,
  position: string
): SpringUserCreatePayload {
  const password = generateHirePassword();
  return {
    email: (application.email ?? "").trim(),
    hashPassword: password,
    userPassword: password,
    password,
    user_password: password,
    newPassword: password,
    plainPassword: password,
    rawPassword: password,
    firstName: application.first_name?.trim() || applicant.full_name?.trim() || "",
    middleName: application.middle_name?.trim() || undefined,
    lastName: application.last_name?.trim() || "",
    nickname: application.nickname?.trim() || undefined,
    contact: application.phone?.trim() ?? "",
    province: "",
    city: "",
    brgy: "",
    position,
    dateOfHire: philippineDate(),
    role: "USER",
    admin: false,
    tags: "Employee",
    birthday: application.birthdate ?? undefined,
    gender: application.sex ?? undefined,
    civilStatus: application.civil_status ?? undefined,
    religion: application.religion ?? undefined,
    sssNumber: application.sss_no ?? undefined,
    philHealthNumber: application.philhealth_no ?? undefined,
    tinNumber: application.tin ?? undefined,
    pagibigNumber: application.pagibig_no ?? undefined,
  };
}
