export interface IdViewerTemplateSummary {
    readonly id: number | string;
    readonly name: string;
    readonly company_id: number | null;
    readonly is_default: boolean;
    readonly design_json?: unknown;
}

export interface IdViewerResolveCompany {
    readonly company_id: unknown;
    readonly company_name: unknown;
    readonly company_code: unknown;
    readonly company_logo: unknown;
}

export interface IdViewerResolveResponse {
    readonly template: IdViewerTemplateSummary | null;
    readonly user: Readonly<Record<string, unknown>>;
    readonly company: IdViewerResolveCompany | null;
}

function isViewerRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function idViewerMessage(value: unknown): string | null {
    if (!isViewerRecord(value)) return null;
    if (typeof value.message === "string" && value.message.trim() !== "") return value.message;
    return null;
}

function toViewerFlag(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function toViewerSummary(row: Record<string, unknown>): IdViewerTemplateSummary {
    const companyId = row.company_id;
    return {
        id: typeof row.id === "number" || typeof row.id === "string" ? row.id : "",
        name: typeof row.name === "string" ? row.name : "",
        company_id: typeof companyId === "number" && Number.isInteger(companyId) ? companyId : null,
        is_default: toViewerFlag(row.is_default),
        design_json: row.design_json,
    };
}

function toViewerCompany(row: Record<string, unknown>): IdViewerResolveCompany {
    return {
        company_id: row.company_id ?? null,
        company_name: row.company_name ?? null,
        company_code: row.company_code ?? null,
        company_logo: row.company_logo ?? null,
    };
}

export async function fetchIdViewerResolve(userId: number): Promise<IdViewerResolveResponse> {
    const res = await fetch(
        `/api/hrm/id-layout/resolve?user_id=${encodeURIComponent(String(userId))}`,
        { cache: "no-store" }
    );
    let json: unknown = null;
    try {
        json = (await res.json()) as unknown;
    } catch {
        json = null;
    }
    if (!res.ok) {
        throw new Error(idViewerMessage(json) ?? `ID resolve failed (HTTP ${res.status})`);
    }
    if (!isViewerRecord(json) || !isViewerRecord(json.user)) {
        throw new Error("ID card is unavailable right now.");
    }
    return {
        template: isViewerRecord(json.template) ? toViewerSummary(json.template) : null,
        user: json.user,
        company: isViewerRecord(json.company) ? toViewerCompany(json.company) : null,
    };
}

function viewerListOf(json: unknown): Array<Record<string, unknown>> {
    if (!isViewerRecord(json)) return [];
    if (Array.isArray(json.data)) return json.data.filter(isViewerRecord);
    if (Array.isArray(json)) return json.filter(isViewerRecord);
    return [];
}

function viewerTotalOf(json: unknown): number | null {
    if (!isViewerRecord(json)) return null;
    if (typeof json.total === "number" && Number.isFinite(json.total)) return json.total;
    return null;
}

export async function listIdViewerTemplates(): Promise<IdViewerTemplateSummary[]> {
    const out: IdViewerTemplateSummary[] = [];
    let page = 1;
    for (let guard = 0; guard < 50; guard += 1) {
        const res = await fetch(`/api/hrm/id-layout/templates?page=${page}`, {
            cache: "no-store",
        });
        let json: unknown = null;
        try {
            json = (await res.json()) as unknown;
        } catch {
            json = null;
        }
        if (!res.ok) {
            throw new Error(idViewerMessage(json) ?? `ID template list failed (HTTP ${res.status})`);
        }
        const batch = viewerListOf(json);
        for (const row of batch) {
            out.push(toViewerSummary(row));
        }
        const total = viewerTotalOf(json);
        if (total !== null && out.length >= total) break;
        if (batch.length === 0) break;
        page += 1;
    }
    return out;
}

export async function getIdViewerTemplate(
    id: string | number,
): Promise<IdViewerTemplateSummary | null> {
    const res = await fetch(`/api/hrm/id-layout/templates/${encodeURIComponent(String(id))}`, {
        cache: "no-store",
    });
    let json: unknown = null;
    try {
        json = (await res.json()) as unknown;
    } catch {
        json = null;
    }
    if (!res.ok) {
        throw new Error(idViewerMessage(json) ?? `ID template read failed (HTTP ${res.status})`);
    }
    if (!isViewerRecord(json)) return null;
    return toViewerSummary(json);
}
