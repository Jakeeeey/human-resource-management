export interface IdTemplateRow {
    id: number;
    name: string;
    company_id: number | null;
    company_name?: string | null;
    is_default: boolean | number;
    is_active: boolean | number;
    design_json?: unknown | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface IdCompanyRow {
    company_id: number;
    company_name: string;
    company_code?: string | null;
}

export interface IdTemplateCreate {
    name: string;
    company_id: number | null;
    is_default: boolean;
    is_active: boolean;
    design_json: unknown;
}

export interface IdTemplatePatch {
    name?: string;
    company_id?: number | null;
    is_default?: boolean;
    is_active?: boolean;
    design_json?: unknown;
}

interface IdEnvelope<T> {
    success?: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

function fieldDetails(errors: Record<string, string[]> | undefined): string | null {
    if (!errors) return null;
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(errors)) {
        if (messages.length > 0) parts.push(`${field}: ${messages.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : null;
}

function pickData<T>(json: unknown): T | undefined {
    if (json === null || json === undefined) return undefined;
    if (Array.isArray(json)) return json as unknown as T;
    if (typeof json !== "object") return json as unknown as T;
    const record = json as Record<string, unknown>;
    if ("data" in record) return record.data as T | undefined;
    if ("rows" in record) return record.rows as T | undefined;
    if ("items" in record) return record.items as T | undefined;
    return json as unknown as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const res = await fetch(`/api/hrm/id-layout${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    let json: unknown = null;
    try {
        json = (await res.json()) as unknown;
    } catch {
        json = null;
    }
    if (!res.ok) {
        const envelope = json as IdEnvelope<T> | null;
        const message = envelope?.message ?? `ID Layout request failed (HTTP ${res.status})`;
        const details = fieldDetails(envelope?.errors);
        throw new Error(details ? `${message} — ${details}` : message);
    }
    return pickData<T>(json);
}

export function isActiveFlag(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

export function isDefaultFlag(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

export async function listIdTemplates(): Promise<IdTemplateRow[]> {
    const data = await request<IdTemplateRow[]>("/templates");
    return data ?? [];
}

export async function getIdTemplate(id: string | number): Promise<IdTemplateRow | null> {
    const data = await request<IdTemplateRow>(`/templates/${encodeURIComponent(String(id))}`);
    return data ?? null;
}

export async function createIdTemplate(payload: IdTemplateCreate): Promise<IdTemplateRow> {
    const data = await request<IdTemplateRow>("/templates", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    if (!data) throw new Error("Create returned no data");
    return data;
}

export async function patchIdTemplate(
    id: string | number,
    payload: IdTemplatePatch,
): Promise<IdTemplateRow> {
    const data = await request<IdTemplateRow>(`/templates/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
    if (!data) throw new Error("Save returned no data");
    return data;
}

export async function deleteIdTemplate(id: string | number): Promise<void> {
    await request<unknown>(`/templates/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

export async function listIdCompanies(): Promise<IdCompanyRow[]> {
    const data = await request<IdCompanyRow[]>("/templates/companies");
    return data ?? [];
}
