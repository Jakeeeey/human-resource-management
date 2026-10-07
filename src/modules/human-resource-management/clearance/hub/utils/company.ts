export interface CompanyOption {
    id: number;
    company_code: string;
    company_name: string;
    company_city: string | null;
    company_address: string | null;
    company_contact: string | null;
    company_email: string | null;
    logo_data_url: string | null;
    is_default: boolean;
}

export const COMPANY_LOGOS_PATH = "/api/hrm/recruitment/job-offer/company-logos";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function toId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
}

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

function normalizeCompanyOption(raw: unknown): CompanyOption | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const code = toNullableText(raw.company_code);
    const name = toNullableText(raw.company_name);
    if (id === null || code === null || name === null) return null;
    const logo = toNullableText(raw.logo_data_url);
    return {
        id,
        company_code: code,
        company_name: name,
        company_city: toNullableText(raw.company_city),
        company_address: toNullableText(raw.company_address),
        company_contact: toNullableText(raw.company_contact),
        company_email: toNullableText(raw.company_email),
        logo_data_url: logo === "" ? null : logo,
        is_default: raw.is_default === true || raw.is_default === 1,
    };
}

export function readCompanyOptions(body: unknown): CompanyOption[] | null {
    if (!isRecord(body)) return null;
    const data: unknown = body.data;
    if (!Array.isArray(data)) return null;
    const options: CompanyOption[] = [];
    for (const entry of data) {
        const option = normalizeCompanyOption(entry);
        if (option) options.push(option);
    }
    return options;
}

export function pickDefaultCompany(options: CompanyOption[], companyCode?: string): CompanyOption | null {
    if (options.length === 0) return null;
    if (companyCode !== undefined && companyCode.trim() !== "") {
        const wanted = companyCode.trim().toLowerCase();
        const exact = options.find((option) => option.company_code.toLowerCase() === wanted);
        if (exact) return exact;
    }
    return options.find((option) => option.is_default) ?? options[0] ?? null;
}

export function companyLogoDataUrl(option: CompanyOption | null): string | null {
    if (!option || !option.logo_data_url) return null;
    return option.logo_data_url.startsWith("data:") ? option.logo_data_url : null;
}

export interface EmployeeCompanyResult {
    user_id: number;
    company_id: number | null;
}

export function pickEmployeeCompany(options: CompanyOption[], companyId: number | null | undefined): CompanyOption | null {
    if (companyId === null || companyId === undefined) return null;
    return options.find((option) => option.id === companyId) ?? null;
}

export async function fetchEmployeeCompany(query: { userId?: number; requestId?: number }): Promise<EmployeeCompanyResult> {
    if (query.userId === undefined && query.requestId === undefined) {
        throw new Error("Could not load the employee company.");
    }
    const params = new URLSearchParams();
    if (query.userId !== undefined) params.set("user_id", String(query.userId));
    if (query.requestId !== undefined) params.set("request_id", String(query.requestId));
    const res = await fetch(`/api/hrm/clearance/employee-company?${params.toString()}`);
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok || !isRecord(body) || body.success !== true || !isRecord(body.data)) {
        throw new Error("Could not load the employee company.");
    }
    const userId = toId(body.data.user_id);
    if (userId === null) throw new Error("Could not load the employee company.");
    return { user_id: userId, company_id: toId(body.data.company_id) };
}
