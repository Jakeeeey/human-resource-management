import {
    QUITCLAIM_SECTION2_SIGNATORY_LABELS,
    QuitClaimValuesSchema,
    type ClearanceQuitclaim,
    type QuitClaimValues,
} from "../types";

export type { ClearanceQuitclaim };
import {
    COMPANY_LOGOS_PATH,
    pickDefaultCompany,
    readCompanyOptions,
    type CompanyOption,
} from "../../utils/company";

export class QuitClaimClientError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "QuitClaimClientError";
        this.status = status;
        this.code = code;
    }
}

export interface QuitClaimDetail extends ClearanceQuitclaim {
    values: QuitClaimValues;
}

export interface ApproveQuitClaimResult {
    quitclaim: ClearanceQuitclaim;
    ref: { ref_no: string };
    clearanceNo: string;
}

async function readJson(res: Response): Promise<unknown> {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function throwForStatus(res: Response, body: unknown, fallback: string): never {
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
    const code = typeof record?.code === "string" ? record.code : undefined;
    const message = typeof record?.message === "string" && record.message !== "" ? record.message : fallback;
    throw new QuitClaimClientError(res.status, message, code);
}

export function isAlreadyApprovedError(error: unknown): boolean {
    return error instanceof QuitClaimClientError && error.status === 409;
}

export function quitClaimErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof QuitClaimClientError) {
        if (error.status === 409) {
            return "This quit claim is already approved. Approved documents are frozen and cannot be edited.";
        }
        return error.message;
    }
    return fallback;
}

export async function getQuitClaim(id: number): Promise<QuitClaimDetail> {
    const res = await fetch(`/api/hrm/clearance/quit-claims/${id}`);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to load the quit claim.");
    }
    return (body as { data: QuitClaimDetail }).data;
}

export async function getQuitClaimValues(id: number): Promise<QuitClaimValues> {
    const res = await fetch(`/api/hrm/clearance/quit-claims/${id}/values`);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to load the quit claim values.");
    }
    return (body as { data: QuitClaimValues }).data;
}

export async function createQuitClaim(input: {
    user_id: number;
    resignation_id?: number | null;
    request_id?: number | null;
    company_name?: string;
}): Promise<QuitClaimDetail> {
    const res = await fetch("/api/hrm/clearance/quit-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to create the quit claim.");
    }
    return (body as { data: QuitClaimDetail }).data;
}

export async function updateQuitClaimValues(id: number, values: QuitClaimValues): Promise<QuitClaimDetail> {
    const res = await fetch(`/api/hrm/clearance/quit-claims/${id}/values`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
    });
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to save the quit claim.");
    }
    return (body as { data: QuitClaimDetail }).data;
}

export async function approveQuitClaim(id: number, companyCode: string): Promise<ApproveQuitClaimResult> {
    const res = await fetch(`/api/hrm/clearance/quit-claims/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_code: companyCode }),
    });
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to approve the quit claim.");
    }
    return (body as { data: ApproveQuitClaimResult }).data;
}

export async function loadCompanyOptions(): Promise<CompanyOption[]> {
    const res = await fetch(COMPANY_LOGOS_PATH);
    if (!res.ok) {
        throw new QuitClaimClientError(res.status, "The company list is unreachable. The letterhead will print without company details.");
    }
    const body = await readJson(res);
    return readCompanyOptions(body) ?? [];
}

export function defaultCompany(options: CompanyOption[], companyCode?: string): CompanyOption | null {
    return pickDefaultCompany(options, companyCode);
}

export function findCompanyByCode(options: CompanyOption[], code: string | undefined): CompanyOption | null {
    if (code === undefined || code.trim() === "") return null;
    const wanted = code.trim().toLowerCase();
    return options.find((option) => option.company_code.toLowerCase() === wanted) ?? null;
}

export function normalizeQuitClaimValues(raw: unknown): QuitClaimValues {
    const checked = QuitClaimValuesSchema.safeParse(raw);
    if (checked.success) {
        const signatories = QUITCLAIM_SECTION2_SIGNATORY_LABELS.map((label) => {
            const found = checked.data.section2_signatories.find((entry) => entry.label === label);
            return { label, name: found?.name ?? "", date: found?.date ?? "" };
        });
        return { ...checked.data, letterhead_company_code: checked.data.letterhead_company_code ?? "", section2_signatories: signatories };
    }
    return {
        identity: { date: "", name: "", position: "", separation: "", company: "" },
        accountabilities: [{ outlet: "", name: "", date: "", remarks: "" }],
        deductions: [{ label: "", amount: "" }],
        due_to_employee: [{ item: "", days: "", amount: "" }],
        totals: { total: "", less_deductions: "", net: "" },
        payment: { amount: "", check_no: "", date: "" },
        released_by: { name: "", title: "", date: "" },
        manager_signature_date: "",
        letterhead_company_code: "",
        section2_signatories: QUITCLAIM_SECTION2_SIGNATORY_LABELS.map((label) => ({ label, name: "", date: "" })),
    };
}
