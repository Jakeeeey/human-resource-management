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
