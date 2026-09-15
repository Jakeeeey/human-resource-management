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
import { extractEmailDomain } from "./hire-email";
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
    `/items/applicant/${applicantId}?fields=id,full_name,position_applied_for,manpower_request_id,status`
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
    "province",
    "city",
    "brgy",
    "position_applied_for",
    "birthdate",
    "birthplace",
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

const HireOfferCompanyRowSchema = z.object({
  company_id: z.number().int().positive().nullable(),
});

/**
 * Resolves the login email domain for a hire from the offer's company:
 * the applicant's `job_offer.company_id` -> `company_list.company_email` ->
 * the substring after `@`. The company is REQUIRED — a missing offer,
 * company, or company_email domain fails with
 * `HIRE_ORCHESTRATOR_ERROR_CODES.companyMissing` rather than guessing one.
 * @param applicantId - Applicant row id.
 * @returns The lowercased company email domain.
 * @throws Error with `readFailed` on a Directus error body and `companyMissing`
 * when the company/domain cannot be resolved.
 */
export async function readHireCompanyDomain(
  applicantId: number
): Promise<string> {
  const offerBody: unknown = await dFetch(
    `/items/job_offer?filter[applicant_id][_eq]=${applicantId}&fields=company_id&limit=1`
  );
  const offerError = directusErrorMessage(offerBody);
  if (offerError) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: job offer for applicant ${applicantId} could not be read (${offerError})`
    );
  }
  const offerRows = z
    .array(HireOfferCompanyRowSchema)
    .safeParse(unwrapData(offerBody));
  const companyId = offerRows.success
    ? (offerRows.data[0]?.company_id ?? null)
    : null;
  if (companyId === null) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.companyMissing}: applicant ${applicantId} has no job offer company to derive the login domain from`
    );
  }

  const companyBody: unknown = await dFetch(
    `/items/company_list/${companyId}?fields=company_email`
  );
  const companyError = directusErrorMessage(companyBody);
  if (companyError) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.readFailed}: company ${companyId} could not be read (${companyError})`
    );
  }
  const company = z
    .object({ company_email: z.string().nullable() })
    .safeParse(unwrapData(companyBody));
  const domain = extractEmailDomain(
    company.success ? company.data.company_email : null
  );
  if (!domain) {
    throw new Error(
      `${HIRE_ORCHESTRATOR_ERROR_CODES.companyMissing}: company ${companyId} for applicant ${applicantId} has no company_email domain`
    );
  }
  return domain;
}

const PASSWORD_LASTNAME_FALLBACK = "employee";

/** Work context the committed manpower request carries into the new account. */
export interface HireRecruitmentProfile {
  /** `manpower_request.requesting_department_id` — becomes `user_department`. */
  departmentId: number | null;
  /** Matching `department_positions.id` for the request's position, when any. */
  positionId: number | null;
  /** `manpower_request.position`, when the request names one. */
  positionTitle: string | null;
}

const EMPTY_RECRUITMENT_PROFILE: HireRecruitmentProfile = {
  departmentId: null,
  positionId: null,
  positionTitle: null,
};

function parsePositiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

async function readDepartmentPositionId(
  departmentId: number,
  position: string
): Promise<number | null> {
  const body: unknown = await dFetch(
    `/items/department_positions?filter[department_id][_eq]=${departmentId}&filter[position][_eq]=${encodeURIComponent(
      position
    )}&fields=id&limit=1`
  );
  const parsed = z
    .object({ data: z.array(z.object({ id: z.number().int().positive() })) })
    .safeParse(body);
  return parsed.success ? (parsed.data.data[0]?.id ?? null) : null;
}

/**
 * Resolves the work context the recruitment pipeline already knows for an
 * applicant: the committed manpower request's department (plus the matching
 * catalog position id and title) so the auto-created account is not left with
 * an unassigned department.
 *
 * Best-effort by design: every hop is optional and any read failure yields the
 * empty profile rather than failing the hire — an unassigned department must
 * never block account creation.
 * @param applicantId - Applicant row id.
 * @returns The resolved department/position, or the empty profile.
 */
export async function readHireRecruitmentProfile(
  applicantId: number
): Promise<HireRecruitmentProfile> {
  try {
    const applicantBody: unknown = await dFetch(
      `/items/applicant/${applicantId}?fields=manpower_request_id`
    );
    const parsedApplicant = z
      .object({ manpower_request_id: z.unknown() })
      .safeParse(unwrapData(applicantBody));
    const requestId = parsedApplicant.success
      ? parsePositiveInt(parsedApplicant.data.manpower_request_id)
      : null;
    if (requestId === null) return EMPTY_RECRUITMENT_PROFILE;

    const requestBody: unknown = await dFetch(
      `/items/manpower_request/${requestId}?fields=requesting_department_id,position`
    );
    const parsedRequest = z
      .object({
        requesting_department_id: z.unknown(),
        position: z.unknown(),
      })
      .safeParse(unwrapData(requestBody));
    if (!parsedRequest.success) return EMPTY_RECRUITMENT_PROFILE;

    const departmentId = parsePositiveInt(
      parsedRequest.data.requesting_department_id
    );
    const positionTitle =
      typeof parsedRequest.data.position === "string" &&
      parsedRequest.data.position.trim() !== ""
        ? parsedRequest.data.position.trim()
        : null;
    const positionId =
      departmentId !== null && positionTitle !== null
        ? await readDepartmentPositionId(departmentId, positionTitle)
        : null;

    return { departmentId, positionId, positionTitle };
  } catch {
    return EMPTY_RECRUITMENT_PROFILE;
  }
}

/**
 * Derives the initial employee password from the hire's last name:
 * `<lastname>123` in lowercase with every non-alphanumeric character removed
 * (e.g. "Landingin" -> "landingin123", "Dela Cruz" -> "delacruz123").
 * Falls back to "employee123" when the last name is absent.
 * @param lastName - The hire's resolved last name.
 * @returns The initial password (never surfaced in logs/evidence).
 */
export function buildHirePassword(lastName: string): string {
  const base =
    lastName.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    PASSWORD_LASTNAME_FALLBACK;
  return `${base}123`;
}

/**
 * Maps the application row to the Spring `/users/create` payload. The
 * applicant's selected province/city/brgy are carried through verbatim
 * (trimmed) — never guessed or split from free text, since the application
 * collects them as PSGC selectors. Missing selections fall back to empty
 * strings, which Spring accepts (live-proven). The recruitment profile (if
 * resolved) supplies the department/position the pipeline already committed,
 * mirroring the field names the manual add form sends.
 * @param application - Linked application row (email + position pre-validated).
 * @param applicant - Applicant row (name fallback).
 * @param position - Resolved position string.
 * @param loginEmail - The generated company login address Spring creates.
 * @param recruitment - Committed department/position, when resolvable.
 * @returns The payload consumed by `createSpringUser`.
 */
export function buildSpringUserPayload(
  application: HireApplicationRow,
  applicant: HireApplicantRow,
  position: string,
  loginEmail: string,
  recruitment: HireRecruitmentProfile = EMPTY_RECRUITMENT_PROFILE
): SpringUserCreatePayload {
  const lastName = application.last_name?.trim() || "";
  const password = buildHirePassword(lastName);
  const personalEmail = (application.email ?? "").trim();
  return {
    email: loginEmail,
    personalEmail: personalEmail || undefined,
    hashPassword: password,
    userPassword: password,
    password,
    user_password: password,
    newPassword: password,
    plainPassword: password,
    rawPassword: password,
    firstName: application.first_name?.trim() || applicant.full_name?.trim() || "",
    middleName: application.middle_name?.trim() || undefined,
    lastName,
    nickname: application.nickname?.trim() || undefined,
    contact: application.phone?.trim() ?? "",
    province: application.province?.trim() ?? "",
    city: application.city?.trim() ?? "",
    brgy: application.brgy?.trim() ?? "",
    position,
    department:
      recruitment.departmentId !== null
        ? String(recruitment.departmentId)
        : undefined,
    position_id: recruitment.positionId ?? undefined,
    dateOfHire: philippineDate(),
    role: "USER",
    admin: false,
    tags: "Employee",
    birthday: application.birthdate ?? undefined,
    placeOfBirth: application.birthplace?.trim() || undefined,
    gender: application.sex ?? undefined,
    civilStatus: application.civil_status ?? undefined,
    religion: application.religion ?? undefined,
    sssNumber: application.sss_no ?? undefined,
    philHealthNumber: application.philhealth_no ?? undefined,
    tinNumber: application.tin ?? undefined,
    pagibigNumber: application.pagibig_no ?? undefined,
  };
}
