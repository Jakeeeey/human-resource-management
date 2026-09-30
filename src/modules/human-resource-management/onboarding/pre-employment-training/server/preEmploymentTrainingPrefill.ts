import { z } from "zod";

import { dFetch, DIRECTUS_URL } from "@/modules/human-resource-management/shared/utils/directus";
import {
  readHireApplicant,
  readHireApplicationByApplicant,
  readHireOfferCompanyId,
  resolveHireApplicantIdByUserId,
  resolveHirePosition,
} from "../../hire/server/hire-application";
import type { PreEmploymentTrainingLetterPrefill } from "../components/types";

export const PRE_EMPLOYMENT_TRAINING_PREFILL_ERROR_CODES = {
  invalidInput: "PRE_EMPLOYMENT_TRAINING_PREFILL_INVALID_INPUT",
} as const;

const CompanyRowSchema = z.looseObject({
  company_name: z.string().nullish(),
  company_brgy: z.string().nullish(),
  company_city: z.string().nullish(),
  company_province: z.string().nullish(),
  company_zipCode: z.string().nullish(),
  company_address: z.string().nullish(),
  company_contact: z.string().nullish(),
  company_email: z.string().nullish(),
  company_logo: z.string().nullish(),
});

const UserRowSchema = z.looseObject({
  user_fname: z.string().nullish(),
  user_mname: z.string().nullish(),
  user_lname: z.string().nullish(),
});

type CompanyRow = z.infer<typeof CompanyRowSchema>;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function joined(parts: Array<string | null | undefined>, separator: string): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part !== "")
    .join(separator);
}

function salutationPrefix(sex: unknown, civilStatus: unknown): string | null {
  if (sex === "Male") return "Mr.";
  if (sex === "Female") return civilStatus === "Married" ? "Mrs." : "Ms.";
  return null;
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 0 ? (parts[parts.length - 1] as string) : "";
  return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

function unwrapData(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return undefined;
}

async function readCompanyRow(companyId: number): Promise<CompanyRow | null> {
  const body: unknown = await dFetch(
    `/items/company_list/${companyId}?fields=company_name,company_brgy,company_city,company_province,company_zipCode,company_address,company_contact,company_email,company_logo`
  );
  const parsed = CompanyRowSchema.safeParse(unwrapData(body));
  return parsed.success ? parsed.data : null;
}

async function readUserName(userId: number): Promise<string> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_fname,user_mname,user_lname&limit=1`
  );
  const data = unwrapData(body);
  if (!Array.isArray(data) || data.length === 0) return "";
  const parsed = UserRowSchema.safeParse(data[0]);
  if (!parsed.success) return "";
  return joined([parsed.data.user_fname, parsed.data.user_mname, parsed.data.user_lname], " ");
}

async function fetchLogoDataUrl(logoFile: unknown): Promise<string | null> {
  if (typeof logoFile !== "string" || !logoFile) return null;
  const match = logoFile.match(/\/?assets\/([a-f0-9-]+)/i);
  const bareUuid = /^[a-f0-9-]{36}$/i.test(logoFile.trim()) ? logoFile.trim() : null;
  const fileId = match ? (match[1] as string) : bareUuid;
  if (!fileId) return null;
  try {
    const res = await fetch(`${DIRECTUS_URL}/assets/${fileId}`, {
      headers: { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` },
    });
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/png";
    const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${bytes}`;
  } catch {
    return null;
  }
}

function companyAddressOf(company: CompanyRow | null): string {
  if (!company) return "";
  return joined(
    [company.company_brgy, company.company_city, company.company_province],
    ", "
  );
}

export async function assemblePreEmploymentTrainingPrefill(identity: {
  userId: number;
  applicantId?: number | null;
}): Promise<PreEmploymentTrainingLetterPrefill> {
  if (!Number.isInteger(identity.userId) || identity.userId <= 0) {
    throw new Error(
      `${PRE_EMPLOYMENT_TRAINING_PREFILL_ERROR_CODES.invalidInput}: userId must be a positive integer`
    );
  }

  let applicantId =
    typeof identity.applicantId === "number" &&
    Number.isInteger(identity.applicantId) &&
    identity.applicantId > 0
      ? identity.applicantId
      : null;
  if (applicantId === null) {
    try {
      applicantId = await resolveHireApplicantIdByUserId(identity.userId);
    } catch {
      applicantId = null;
    }
  }

  const applicant =
    applicantId !== null ? await readHireApplicant(applicantId).catch(() => null) : null;
  const application =
    applicantId !== null
      ? await readHireApplicationByApplicant(applicantId).catch(() => null)
      : null;

  let companyId: number | null = null;
  if (applicantId !== null) {
    try {
      companyId = await readHireOfferCompanyId(applicantId);
    } catch {
      companyId = null;
    }
  }
  const company =
    companyId !== null ? await readCompanyRow(companyId).catch(() => null) : null;

  const userName = await readUserName(identity.userId).catch(() => "");
  const applicationName = application
    ? joined([application.first_name, application.middle_name, application.last_name], " ")
    : "";
  const applicantName = userName || applicationName || trimmed(applicant?.full_name);

  const applicantAddress = application
    ? joined([application.brgy, application.city, application.province], ", ")
    : "";

  const prefix = application ? salutationPrefix(application.sex, application.civil_status) : null;
  const surname = surnameOf(applicantName);
  const salutationName = prefix ? (surname ? `${prefix} ${surname}` : prefix) : "";

  let position = "";
  if (application && applicant) {
    position = resolveHirePosition(application, applicant) ?? "";
  }

  return {
    applicantName,
    applicantAddress,
    salutationName,
    position,
    companyName: trimmed(company?.company_name),
    headerAddress: companyAddressOf(company),
    headerContact: trimmed(company?.company_contact),
    headerEmail: trimmed(company?.company_email),
    logoDataUrl: await fetchLogoDataUrl(company?.company_logo),
  };
}
