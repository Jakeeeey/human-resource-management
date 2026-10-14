import {
    normalizeTurnoverData,
    type ClearanceTurnoverRow,
    type TurnoverData,
    type TurnoverStatus,
} from "../types";

export class TurnoverClientError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "TurnoverClientError";
        this.status = status;
        this.code = code;
    }
}

const TURNOVER_API = "/api/hrm/clearance/turnover";

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

function toStatus(value: unknown): TurnoverStatus | null {
    return value === "pending" || value === "approved" ? value : null;
}

async function readJson(res: Response): Promise<unknown> {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function readMessage(body: unknown, fallback: string): string {
    if (isRecord(body) && typeof body.message === "string" && body.message.trim() !== "") {
        return body.message;
    }
    return fallback;
}

function throwForStatus(res: Response, body: unknown, fallback: string): never {
    const code = isRecord(body) && typeof body.code === "string" ? body.code : undefined;
    throw new TurnoverClientError(res.status, readMessage(body, fallback), code);
}

export function isAlreadyApprovedError(error: unknown): boolean {
    return error instanceof TurnoverClientError && error.status === 409;
}

export function turnoverErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof TurnoverClientError) {
        if (error.status === 409) {
            return "This turnover checklist is already approved. Approved documents are frozen and cannot be edited.";
        }
        return error.message;
    }
    return fallback;
}

async function request(path: string, init: RequestInit | undefined, fallback: string): Promise<unknown> {
    const res = await fetch(`${TURNOVER_API}${path}`, init);
    const body = await readJson(res);
    if (!res.ok) {
        throwForStatus(res, body, fallback);
    }
    if (!isRecord(body) || body.success !== true) {
        throw new TurnoverClientError(res.status, readMessage(body, fallback));
    }
    return body.data;
}

function normalizeRow(raw: unknown): ClearanceTurnoverRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        pdf_file: toNullableText(raw.pdf_file),
        data: normalizeTurnoverData(raw.data),
        approved_at: toNullableText(raw.approved_at),
        approved_by: toId(raw.approved_by),
        created_at: toNullableText(raw.created_at),
        updated_at: toNullableText(raw.updated_at),
    };
}

export async function getTurnoverByRequest(requestId: number): Promise<ClearanceTurnoverRow> {
    const data = await request(
        `/by-request?request_id=${requestId}`,
        { cache: "no-store" },
        "Could not load the turnover checklist. Please try again."
    );
    const row = normalizeRow(data);
    if (row === null) {
        throw new TurnoverClientError(500, "Could not load the turnover checklist. Please try again.");
    }
    return row;
}

export async function saveTurnover(id: number, data: TurnoverData): Promise<ClearanceTurnoverRow> {
    const body = await request(
        `/${id}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        },
        "Could not save the turnover checklist. Please try again."
    );
    const row = normalizeRow(body);
    if (row === null) {
        throw new TurnoverClientError(500, "Could not save the turnover checklist. Please try again.");
    }
    return row;
}

export async function approveTurnover(id: number, companyCode: string): Promise<void> {
    await request(
        `/${id}/approve`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_code: companyCode }),
        },
        "Could not approve the turnover checklist. Please try again."
    );
}
