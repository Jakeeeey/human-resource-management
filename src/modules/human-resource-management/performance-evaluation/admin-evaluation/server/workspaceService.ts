import { z } from "zod";

import { dFetch, DIRECTUS_URL } from "../utils/directus";

import {
  EmployeeEvaluationItemSchema,
  EmployeeEvaluationSchema,
  EmployeePipActionPlanSchema,
  EmployeePipAreaSchema,
  EmployeePipSchema,
  EvaluationCompanySchema,
  EvaluationTrackingSchema,
  WorkspaceBundleSchema,
  type EvaluationCompany,
  type EvaluationTracking,
  type WorkspaceBundle,
} from "../types/performance-evaluation.schema";
import {
  EVALUATION_ERROR_CODES,
  unwrapData,
} from "./evaluationApiServer";

export const SEPARATION_TYPES = [
  "failed_probation",
  "laid_off",
  "resigned",
] as const;

export type SeparationType = (typeof SEPARATION_TYPES)[number];

const RosterEmployeeSchema = z.object({
  user_id: z.number().int(),
  user_fname: z.string().nullish(),
  user_mname: z.string().nullish(),
  user_lname: z.string().nullish(),
  user_department: z
    .union([
      z.number().int(),
      z.string().regex(/^\d+$/),
      z.object({ department_id: z.number().int() }),
    ])
    .nullish(),
  user_position: z.string().nullish(),
  user_dateOfHire: z.string().nullish(),
  company_id: z.union([z.number().int(), z.string().regex(/^\d+$/)]).nullish(),
  isDeleted: z.unknown().optional(),
  is_deleted: z.unknown().optional(),
  deleted: z.unknown().optional(),
});

type RosterEmployee = z.infer<typeof RosterEmployeeSchema>;

const RosterDepartmentSchema = z.object({
  department_id: z.number().int(),
  department_name: z.string().nullish(),
});

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

function toFullName(employee: RosterEmployee): string {
  const name = [employee.user_fname, employee.user_mname, employee.user_lname]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim() !== ""
    )
    .join(" ")
    .trim();
  return name === "" ? `User #${employee.user_id}` : name;
}

function toDepartmentId(
  value: RosterEmployee["user_department"]
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return value.department_id > 0 ? value.department_id : null;
}

function toCompanyId(
  value: RosterEmployee["company_id"]
): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const CompanyListRowSchema = z.object({
  company_id: z.number().int(),
  company_name: z.string().nullish(),
  company_address: z.string().nullish(),
  company_brgy: z.string().nullish(),
  company_city: z.string().nullish(),
  company_province: z.string().nullish(),
  company_zipCode: z.string().nullish(),
  company_contact: z.string().nullish(),
  company_email: z.string().nullish(),
  company_logo: z.string().nullish(),
});

const COMPANY_FIELDS =
  "company_id,company_name,company_address,company_brgy,company_city,company_province,company_zipCode,company_contact,company_email,company_logo";

async function fetchCompanyLogoDataUrl(
  logoFile: string | null | undefined
): Promise<string | null> {
  if (typeof logoFile !== "string" || logoFile.trim() === "") return null;
  const trimmed = logoFile.trim();
  const assetMatch = trimmed.match(/\/?assets\/([a-f0-9-]+)/i);
  const bareUuid = /^[a-f0-9-]{36}$/i.test(trimmed) ? trimmed : null;
  const fileId = assetMatch ? assetMatch[1] : bareUuid;
  if (!fileId) return null;
  try {
    const res = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}`,
      },
    });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${bytes}`;
  } catch {
    return null;
  }
}

async function resolveEmployeeCompany(
  companyId: number | null
): Promise<EvaluationCompany | null> {
  if (companyId === null) return null;
  try {
    const body: unknown = await dFetch(
      `/items/company_list/${companyId}?fields=${COMPANY_FIELDS}`
    );
    const row = unwrapData<unknown>(body);
    const parsed = CompanyListRowSchema.safeParse(row);
    if (!parsed.success) return null;
    const source = parsed.data;
    const candidate = {
      company_id: source.company_id,
      company_name: source.company_name?.trim() ? source.company_name : "",
      company_address: normalizeText(source.company_address),
      company_brgy: normalizeText(source.company_brgy),
      company_city: normalizeText(source.company_city),
      company_province: normalizeText(source.company_province),
      company_zipCode: normalizeText(source.company_zipCode),
      company_contact: normalizeText(source.company_contact),
      company_email: normalizeText(source.company_email),
      logo_data_url: await fetchCompanyLogoDataUrl(source.company_logo),
    };
    const company = EvaluationCompanySchema.safeParse(candidate);
    return company.success ? company.data : null;
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function resolveWorkspaceEmployee(
  userId: number,
  tracking: EvaluationTracking | null
) {
  const employeeBody: unknown = await dFetch(
    `/items/user/${userId}?fields=user_id,user_fname,user_mname,user_lname,user_department,user_position,user_dateOfHire,company_id`
  );
  const employeeData = unwrapData<unknown>(employeeBody);
  const employeeRow = Array.isArray(employeeData) ? employeeData[0] : employeeData;
  const parsedEmployee = RosterEmployeeSchema.safeParse(employeeRow);
  if (!parsedEmployee.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: user read failed (${JSON.stringify(parsedEmployee.error.flatten()).slice(0, 300)})`
    );
  }
  const employee = parsedEmployee.data;
  const departmentId = toDepartmentId(employee.user_department);
  let departmentName: string | null = null;
  if (departmentId !== null) {
    const departmentBody: unknown = await dFetch(
      `/items/department?filter[department_id][_eq]=${departmentId}&fields=department_id,department_name&limit=1`
    );
    const departments = parseRowList(
      RosterDepartmentSchema,
      departmentBody,
      "department"
    );
    departmentName = normalizeText(departments[0]?.department_name ?? null);
  }
  return {
    user_id: employee.user_id,
    full_name: toFullName(employee),
    department_id: departmentId,
    department_name: departmentName,
    position: normalizeText(employee.user_position),
    company_id: toCompanyId(employee.company_id),
    date_hired:
      normalizeText(tracking?.date_hired_snapshot) ??
      normalizeText(employee.user_dateOfHire),
  };
}

export async function getEvaluationWorkspace(
  userId: number
): Promise<WorkspaceBundle> {
  const trackingBody: unknown = await dFetch(
    `/items/employee_evaluation_tracking?filter[user_id][_eq]=${userId}&limit=1`
  );
  const trackingRows = parseRowList(
    EvaluationTrackingSchema,
    trackingBody,
    "employee_evaluation_tracking"
  );
  const evaluationBody: unknown = await dFetch(
    `/items/employee_evaluation?filter[user_id][_eq]=${userId}&limit=-1`
  );
  const evaluations = parseRowList(
    EmployeeEvaluationSchema,
    evaluationBody,
    "employee_evaluation"
  );
  const evaluationIds = evaluations.map((evaluation) => evaluation.id);
  const evaluationItems =
    evaluationIds.length === 0
      ? []
      : parseRowList(
          EmployeeEvaluationItemSchema,
          await dFetch(
            `/items/employee_evaluation_item?filter[evaluation_id][_in]=${evaluationIds.join(",")}&limit=-1`
          ),
          "employee_evaluation_item"
        );
  const pipBody: unknown = await dFetch(
    `/items/employee_pip?filter[user_id][_eq]=${userId}&limit=-1`
  );
  const pips = parseRowList(EmployeePipSchema, pipBody, "employee_pip");
  const pipIds = pips.map((pip) => pip.id);
  const pipAreas =
    pipIds.length === 0
      ? []
      : parseRowList(
          EmployeePipAreaSchema,
          await dFetch(
            `/items/employee_pip_area?filter[pip_id][_in]=${pipIds.join(",")}&limit=-1`
          ),
          "employee_pip_area"
        );
  const pipActionPlans =
    pipIds.length === 0
      ? []
      : parseRowList(
          EmployeePipActionPlanSchema,
          await dFetch(
            `/items/employee_pip_action_plan?filter[pip_id][_in]=${pipIds.join(",")}&limit=-1`
          ),
          "employee_pip_action_plan"
        );
  const employee = await resolveWorkspaceEmployee(
    userId,
    trackingRows[0] ?? null
  );
  const bundle = {
    employee,
    company: await resolveEmployeeCompany(employee.company_id),
    tracking: trackingRows[0] ?? null,
    evaluations,
    evaluationItems,
    pips,
    pipAreas,
    pipActionPlans,
  };
  const parsed = WorkspaceBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    throw new Error(
      `${EVALUATION_ERROR_CODES.readFailed}: workspace bundle contract mismatch (${JSON.stringify(parsed.error.flatten()).slice(0, 300)})`
    );
  }
  return parsed.data;
}
