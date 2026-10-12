export const ID_TEMPLATES_COLLECTION = "id_templates";

export const ID_TEMPLATE_LIST_FIELDS = "id,name,company_id,is_default,is_active,updated_at";

export const ID_TEMPLATE_FULL_FIELDS =
    "id,name,company_id,is_default,design_json,is_active,created_at,created_by,updated_at,updated_by";

export const DIRECTUS_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

export async function dFetch(path: string, options?: RequestInit): Promise<unknown> {
    const res = await fetch(`${DIRECTUS_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${STATIC_TOKEN}`,
            ...(options?.headers || {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        console.error("DIRECTUS ERROR:", text);
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(text);
        }
    }
    if (res.status === 204) {
        return null;
    }
    return res.json();
}

export function nowUTC(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function directusMessage(value: unknown): string | null {
    if (!isRecord(value)) {
        return null;
    }
    const errors = value.errors;
    if (Array.isArray(errors) && errors.length > 0) {
        const first = errors[0];
        if (isRecord(first) && typeof first.message === "string") {
            return first.message;
        }
    }
    if (typeof value.message === "string") {
        return value.message;
    }
    return null;
}

export function parseDesignJson(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export function coerceDesignInput(value: unknown): unknown {
    if (typeof value !== "string") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export function toListRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
        id: row.id,
        name: row.name,
        company_id: row.company_id ?? null,
        is_default: row.is_default ?? false,
        is_active: row.is_active ?? true,
        updated_at: row.updated_at ?? null,
    };
}

export function toFullRow(row: Record<string, unknown>): Record<string, unknown> {
    return {
        id: row.id,
        name: row.name,
        company_id: row.company_id ?? null,
        is_default: row.is_default ?? false,
        design_json: parseDesignJson(row.design_json),
        is_active: row.is_active ?? true,
        created_at: row.created_at ?? null,
        created_by: row.created_by ?? null,
        updated_at: row.updated_at ?? null,
        updated_by: row.updated_by ?? null,
    };
}

export async function readTemplateById(id: unknown): Promise<Record<string, unknown> | null> {
    const text = String(id ?? "").trim();
    if (text === "") {
        return null;
    }
    const body: unknown = await dFetch(
        `/items/${ID_TEMPLATES_COLLECTION}?fields=${ID_TEMPLATE_FULL_FIELDS}&filter[id][_eq]=${encodeURIComponent(text)}&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data) || body.data.length === 0) {
        return null;
    }
    const first: unknown = body.data[0];
    return isRecord(first) ? first : null;
}
