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
} from "../utils/company";

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

export interface QuitClaimListResult {
    data: ClearanceQuitclaim[];
    total: number;
    page: number;
    limit: number;
}

export interface EmployeeOption {
    user_id: number;
    full_name: string;
    user_position: string | null;
}

export interface EmployeeOptionResult {
    data: EmployeeOption[];
    total: number;
    page: number;
    limit: number;
}

export interface ResignationOption {
    id: number;
    user_id: number;
    employee_name: string;
    filed_at: string | null;
    resignation_date: string | null;
}

export interface ResignationOptionResult {
    data: ResignationOption[];
    total: number;
    page: number;
    limit: number;
}

export interface IssueQuitClaimResult {
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

export function isAlreadyIssuedError(error: unknown): boolean {
    return error instanceof QuitClaimClientError && error.status === 409;
}

export function quitClaimErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof QuitClaimClientError) {
        if (error.status === 409) {
            return "This quit claim is already issued. Issued documents are frozen and cannot be edited.";
        }
        return error.message;
    }
    return fallback;
}

export async function listQuitClaims(query: {
    page: number;
    limit: number;
    status?: string;
}): Promise<QuitClaimListResult> {
    const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
    });
    if (query.status !== undefined && query.status !== "all") {
        params.set("status", query.status);
    }
    const res = await fetch(`/api/hrm/clearance/quit-claims?${params.toString()}`);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to load quit claims.");
    }
    const record = body as { data?: unknown; total?: unknown; page?: unknown; limit?: unknown };
    return {
        data: Array.isArray(record.data) ? (record.data as ClearanceQuitclaim[]) : [],
        total: typeof record.total === "number" ? record.total : 0,
        page: typeof record.page === "number" ? record.page : query.page,
        limit: typeof record.limit === "number" ? record.limit : query.limit,
    };
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

export async function issueQuitClaim(id: number, companyCode: string): Promise<IssueQuitClaimResult> {
    const res = await fetch(`/api/hrm/clearance/quit-claims/${id}/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_code: companyCode }),
    });
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to issue the quit claim.");
    }
    return (body as { data: IssueQuitClaimResult }).data;
}

export async function listEmployeeOptions(query: {
    page: number;
    limit: number;
    search: string;
}): Promise<EmployeeOptionResult> {
    const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
    });
    if (query.search.trim() !== "") {
        params.set("search", query.search.trim());
    }
    const res = await fetch(`/api/hrm/clearance/quit-claims/employees/options?${params.toString()}`);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to load employees.");
    }
    const record = body as { data?: unknown; total?: unknown; page?: unknown; limit?: unknown };
    return {
        data: Array.isArray(record.data) ? (record.data as EmployeeOption[]) : [],
        total: typeof record.total === "number" ? record.total : 0,
        page: typeof record.page === "number" ? record.page : query.page,
        limit: typeof record.limit === "number" ? record.limit : query.limit,
    };
}

export async function listResignationOptions(query: {
    page: number;
    limit: number;
    userId?: number;
}): Promise<ResignationOptionResult> {
    const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.limit),
    });
    if (query.userId !== undefined) {
        params.set("user_id", String(query.userId));
    }
    const res = await fetch(`/api/hrm/clearance/quit-claims/resignations/options?${params.toString()}`);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, "Failed to load resignations.");
    }
    const record = body as { data?: unknown; total?: unknown; page?: unknown; limit?: unknown };
    return {
        data: Array.isArray(record.data) ? (record.data as ResignationOption[]) : [],
        total: typeof record.total === "number" ? record.total : 0,
        page: typeof record.page === "number" ? record.page : query.page,
        limit: typeof record.limit === "number" ? record.limit : query.limit,
    };
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

export async function findRequestIdForResignation(resignationId: number): Promise<number | null> {
    try {
        const res = await fetch(`/api/hrm/clearance/requests?resignation_id=${resignationId}`);
        if (!res.ok) {
            return null;
        }
        const body = (await readJson(res)) as { data?: Array<{ id?: unknown }> } | null;
        const first = Array.isArray(body?.data) ? body?.data[0] : undefined;
        return typeof first?.id === "number" && Number.isInteger(first.id) ? first.id : null;
    } catch {
        return null;
    }
}

export function normalizeQuitClaimValues(raw: unknown): QuitClaimValues {
    const checked = QuitClaimValuesSchema.safeParse(raw);
    if (checked.success) {
        const signatories = QUITCLAIM_SECTION2_SIGNATORY_LABELS.map((label) => {
            const found = checked.data.section2_signatories.find((entry) => entry.label === label);
            return { label, name: found?.name ?? "", date: found?.date ?? "" };
        });
        return { ...checked.data, section2_signatories: signatories };
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
        section2_signatories: QUITCLAIM_SECTION2_SIGNATORY_LABELS.map((label) => ({ label, name: "", date: "" })),
    };
}
