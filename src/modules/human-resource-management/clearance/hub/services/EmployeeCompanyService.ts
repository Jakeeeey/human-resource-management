import { dFetch } from "../utils/directus";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function hasErrors(body: unknown): boolean {
    if (!isRecord(body)) return false;
    return Array.isArray(body.errors) && body.errors.length > 0;
}

function toId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        return Number.isInteger(parsed) ? parsed : null;
    }
    return null;
}

function toPositiveId(value: unknown): number | null {
    const id = toId(value);
    return id !== null && id > 0 ? id : null;
}

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    try {
        const body: unknown = await dFetch(path);
        if (!isRecord(body) || hasErrors(body)) return null;
        return isRecord(body.data) ? body.data : null;
    } catch {
        return null;
    }
}

async function readFirstOrNull(path: string): Promise<Record<string, unknown> | null> {
    try {
        const body: unknown = await dFetch(path);
        if (!isRecord(body) || hasErrors(body)) return null;
        const data: unknown = body.data;
        if (!Array.isArray(data) || data.length === 0) return null;
        const first: unknown = data[0];
        return isRecord(first) ? first : null;
    } catch {
        return null;
    }
}

export async function readEmployeeCompanyId(userId: number): Promise<number | null> {
    if (!Number.isInteger(userId) || userId <= 0) return null;
    const user = await readSingleOrNull(`/items/user/${userId}?fields=user_id,company_id`);
    if (!user) return null;
    return toPositiveId(user.company_id);
}

export async function readCompanyCode(companyId: number): Promise<string | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) return null;
    const row = await readFirstOrNull(
        `/items/company_list?filter[company_id][_eq]=${companyId}&fields=company_id,company_code&limit=1`
    );
    if (!row) return null;
    const code = toNullableText(row.company_code);
    if (code === null || code.trim() === "") return null;
    return code.trim();
}

export async function resolveCompanyCodeForUser(userId: number): Promise<string | null> {
    const companyId = await readEmployeeCompanyId(userId);
    if (companyId === null) return null;
    return readCompanyCode(companyId);
}
