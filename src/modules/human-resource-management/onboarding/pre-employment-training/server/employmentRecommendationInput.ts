import { z } from "zod";

import { dFetch, DIRECTUS_URL } from "@/modules/human-resource-management/shared/utils/directus";
import {
  readHireApplicant,
  readHireApplicationByApplicant,
  resolveHireApplicantIdByUserId,
  resolveHirePosition,
} from "../../hire/server/hire-application";
import type {
  HireApplicantRow,
  HireApplicationRow,
} from "../../hire/types/hire.schema";
import type { EmploymentRecommendationPdfInput } from "../utils/employmentRecommendationPdf";

export interface EmploymentRecommendationHireIdentity {
  userId: number;
  applicantId?: number | null;
  effectivityDate?: string;
}

export interface EmploymentRecommendationAssembled {
  input: EmploymentRecommendationPdfInput;
  logoDataUrl: string | null;
}

const JobOfferTermsSchema = z.looseObject({
  signatoryName: z.string().nullish(),
  signatoryTitle: z.string().nullish(),
  companyName: z.string().nullish(),
  position: z.string().nullish(),
  department: z.string().nullish(),
  headerAddress: z.string().nullish(),
  headerContact: z.string().nullish(),
  headerEmail: z.string().nullish(),
  probationText: z.string().nullish(),
});

type JobOfferTerms = z.infer<typeof JobOfferTermsSchema>;

const JobOfferRowSchema = z.looseObject({
  company_id: z.number().int().positive().nullish(),
  terms_snapshot: z.unknown().nullish(),
});

const CompanyRowSchema = z.looseObject({
  company_name: z.string().nullish(),
  company_address: z.string().nullish(),
  company_contact: z.string().nullish(),
  company_email: z.string().nullish(),
  company_logo: z.string().nullish(),
});

const HireUserRowSchema = z.looseObject({
  user_fname: z.string().nullish(),
  user_mname: z.string().nullish(),
  user_lname: z.string().nullish(),
});

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unwrapData(body: unknown): unknown {
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return undefined;
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

function joinName(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part !== "")
    .join(" ");
}

async function readJobOfferRow(applicantId: number): Promise<{ companyId: number | null; terms: JobOfferTerms | null }> {
  const body: unknown = await dFetch(
    `/items/job_offer?filter[applicant_id][_eq]=${applicantId}&fields=company_id,terms_snapshot&limit=1`
  );
  const data = unwrapData(body);
  if (!Array.isArray(data) || data.length === 0) return { companyId: null, terms: null };
  const parsed = JobOfferRowSchema.safeParse(data[0]);
  if (!parsed.success) return { companyId: null, terms: null };
  const terms = JobOfferTermsSchema.safeParse(parsed.data.terms_snapshot);
  return {
    companyId: parsed.data.company_id ?? null,
    terms: terms.success ? terms.data : null,
  };
}

async function readCompanyRow(companyId: number): Promise<z.infer<typeof CompanyRowSchema> | null> {
  const body: unknown = await dFetch(
    `/items/company_list/${companyId}?fields=company_name,company_address,company_contact,company_email,company_logo`
  );
  const parsed = CompanyRowSchema.safeParse(unwrapData(body));
  return parsed.success ? parsed.data : null;
}

async function readHireUserName(userId: number): Promise<string> {
  const body: unknown = await dFetch(
    `/items/user?filter[user_id][_eq]=${userId}&fields=user_id,user_fname,user_mname,user_lname&limit=1`
  );
  const data = unwrapData(body);
  if (!Array.isArray(data) || data.length === 0) return "";
  const parsed = HireUserRowSchema.safeParse(data[0]);
  if (!parsed.success) return "";
  return joinName([parsed.data.user_fname, parsed.data.user_mname, parsed.data.user_lname]);
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

export async function assembleEmploymentRecommendationInput(
  identity: EmploymentRecommendationHireIdentity
): Promise<EmploymentRecommendationAssembled> {
  if (!Number.isInteger(identity.userId) || identity.userId <= 0) {
    throw new Error(`EMPLOYMENT_RECOMMENDATION_INVALID_INPUT: userId must be a positive integer`);
  }

  let applicantId = typeof identity.applicantId === "number" && Number.isInteger(identity.applicantId) && identity.applicantId > 0
    ? identity.applicantId
    : null;
  if (applicantId === null) {
    try {
      applicantId = await resolveHireApplicantIdByUserId(identity.userId);
    } catch {
      applicantId = null;
    }
  }

  let applicant: HireApplicantRow | null = null;
  let application: HireApplicationRow | null = null;
  if (applicantId !== null) {
    try {
      applicant = await readHireApplicant(applicantId);
    } catch {
      applicant = null;
    }
    try {
      application = await readHireApplicationByApplicant(applicantId);
    } catch {
      application = null;
    }
  }

  let offerCompanyId: number | null = null;
  let terms: JobOfferTerms | null = null;
  if (applicantId !== null) {
    try {
      const offer = await readJobOfferRow(applicantId);
      offerCompanyId = offer.companyId;
      terms = offer.terms;
    } catch {
      offerCompanyId = null;
      terms = null;
    }
  }

  let company: z.infer<typeof CompanyRowSchema> | null = null;
  if (offerCompanyId !== null) {
    try {
      company = await readCompanyRow(offerCompanyId);
    } catch {
      company = null;
    }
  }

  let userName = "";
  try {
    userName = await readHireUserName(identity.userId);
  } catch {
    userName = "";
  }

  const applicationName = application
    ? joinName([application.first_name, application.middle_name, application.last_name])
    : "";
  const employeeName = userName || applicationName || trimmed(applicant?.full_name);

  const employeeAddress = application
    ? [application.brgy, application.city, application.province]
        .filter((part): part is string => typeof part === "string" && part.trim() !== "")
        .map((part) => part.trim())
        .join(", ")
    : "";

  const prefix = application ? salutationPrefix(application.sex, application.civil_status) : null;
  const surname = surnameOf(employeeName);
  const salutationName = prefix ? (surname ? `${prefix} ${surname}` : prefix) : "";

  let position = "";
  if (application && applicant) {
    position = resolveHirePosition(application, applicant) ?? "";
  }
  if (!position) position = trimmed(terms?.position);

  const companyName = trimmed(terms?.companyName) || trimmed(company?.company_name);
  const headerAddress = trimmed(terms?.headerAddress) || trimmed(company?.company_address);
  const headerContact = trimmed(terms?.headerContact) || trimmed(company?.company_contact);
  const headerEmail = trimmed(terms?.headerEmail) || trimmed(company?.company_email);

  const today = todayInputValue();
  const effectivityDate = trimmed(identity.effectivityDate) || today;

  const probationText = trimmed(terms?.probationText);
  const department = trimmed(terms?.department);

  const signatoryName = trimmed(terms?.signatoryName);
  const signatoryTitle = trimmed(terms?.signatoryTitle);

  const logoDataUrl = await fetchLogoDataUrl(company?.company_logo);

  return {
    input: {
      employeeName,
      employeeAddress,
      salutationName,
      position,
      ...(department ? { department } : {}),
      companyName,
      headerAddress,
      headerContact,
      headerEmail,
      letterDate: today,
      effectivityDate,
      ...(probationText ? { probationText } : {}),
      preparedBy: { name: signatoryName, title: signatoryTitle },
      notedBy: { name: signatoryName, title: signatoryTitle },
      approvedBy: { name: signatoryName, title: signatoryTitle },
      acknowledgement: { printedName: employeeName },
    },
    logoDataUrl,
  };
}
