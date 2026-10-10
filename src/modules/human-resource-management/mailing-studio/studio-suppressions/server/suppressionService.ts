import { NextResponse } from "next/server";

import { unwrapStudioSuppressionsData } from "./capability";
import { SUPPRESSION_REASONS, type MsSuppressionRow, type SuppressionReason } from "../types";
import { nowUTC, stampCreate } from "../utils/audit";
import { dFetch } from "../utils/directus";

export class SuppressionNotFoundError extends Error {
    readonly status = 404;

    constructor(message: string) {
        super(message);
        this.name = "SuppressionNotFoundError";
    }
}

export class SuppressionConflictError extends Error {
    readonly status = 409;

    constructor(message: string) {
        super(message);
        this.name = "SuppressionConflictError";
    }
}

export class SuppressionValidationError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = "SuppressionValidationError";
    }
}

export function toSuppressionErrorResponse(error: unknown): NextResponse {
    if (
        error instanceof SuppressionNotFoundError ||
        error instanceof SuppressionConflictError ||
        error instanceof SuppressionValidationError
    ) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

export interface SuppressionListFilter {
    reason?: SuppressionReason;
}

export interface SuppressionListResult {
    rows: MsSuppressionRow[];
    total: number;
}

const SUPPRESSIONS = "/items/ms_suppressions";
const SUPPRESSION_FIELDS = "id,email,reason,note,created_at,created_by";

export function normalizeSuppressionEmail(value: string): string {
    return value.trim().toLowerCase();
}

function assertSuppressionReason(reason: string): asserts reason is SuppressionReason {
    if (!(SUPPRESSION_REASONS as readonly string[]).includes(reason)) {
        throw new SuppressionValidationError(`Unknown suppression reason "${reason}"`);
    }
}

function isDuplicateMessage(message: string): boolean {
    const text = message.toLowerCase();
    return text.includes("duplicate") || text.includes("unique") || text.includes("already exists");
}

function throwIfDirectusErrors(body: unknown, context: string): void {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        const message =
            Array.isArray(errors) && errors.length > 0
                ? errors.map((entry) => entry.message ?? "unknown error").join("; ")
                : context;
        if (isDuplicateMessage(message)) {
            throw new SuppressionConflictError(message);
        }
        throw new Error(`${context}: ${message}`);
    }
}

function readTotalCount(body: unknown, fallback: number): number {
    if (typeof body === "object" && body !== null && "meta" in body) {
        const meta = (body as { meta?: { total_count?: unknown; filter_count?: unknown } }).meta;
        const total = meta?.total_count ?? meta?.filter_count;
        if (typeof total === "number" && Number.isInteger(total) && total >= 0) return total;
    }
    return fallback;
}

async function readSuppressionByEmail(email: string): Promise<MsSuppressionRow | null> {
    const body = await dFetch(
        `${SUPPRESSIONS}?filter[email][_eq]=${encodeURIComponent(email)}&fields=${SUPPRESSION_FIELDS}&limit=1`
    );
    const rows = unwrapStudioSuppressionsData<MsSuppressionRow[]>(body);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function readSuppressionRow(id: number): Promise<MsSuppressionRow | null> {
    const body = await dFetch(`${SUPPRESSIONS}?filter[id][_eq]=${id}&fields=${SUPPRESSION_FIELDS}&limit=1`);
    const rows = unwrapStudioSuppressionsData<MsSuppressionRow[]>(body);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

export async function listSuppressions(filter?: SuppressionListFilter): Promise<SuppressionListResult> {
    if (filter?.reason !== undefined) {
        assertSuppressionReason(filter.reason);
    }
    const clause = filter?.reason === undefined ? "" : `&filter[reason][_eq]=${encodeURIComponent(filter.reason)}`;
    const body = await dFetch(
        `${SUPPRESSIONS}?fields=${SUPPRESSION_FIELDS}&sort=-id&limit=-1&meta=total_count,filter_count${clause}`
    );
    const rows = unwrapStudioSuppressionsData<MsSuppressionRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list, total: readTotalCount(body, list.length) };
}

export async function addSuppression(
    email: string,
    reason: SuppressionReason,
    note: string | null | undefined,
    actor: string | null
): Promise<MsSuppressionRow> {
    assertSuppressionReason(reason);
    const normalized = normalizeSuppressionEmail(email);
    if (normalized === "") {
        throw new SuppressionValidationError("Suppression email is required");
    }
    const existing = await readSuppressionByEmail(normalized);
    if (existing) return existing;
    const payload = stampCreate(
        { created_at: nowUTC(), email: normalized, reason, note: note ?? null },
        actor
    );
    try {
        const body = await dFetch(SUPPRESSIONS, { method: "POST", body: JSON.stringify(payload) });
        throwIfDirectusErrors(body, "Failed to add suppression");
        return unwrapStudioSuppressionsData<MsSuppressionRow>(body);
    } catch (error) {
        if (error instanceof SuppressionConflictError) {
            const raced = await readSuppressionByEmail(normalized);
            if (raced) return raced;
        }
        throw error;
    }
}

export async function removeSuppression(id: number, actor: string | null): Promise<MsSuppressionRow> {
    if (actor === null || actor.trim() === "") {
        throw new SuppressionValidationError("Actor is required");
    }
    const existing = await readSuppressionRow(id);
    if (!existing) {
        throw new SuppressionNotFoundError("Suppression not found");
    }
    await dFetch(`${SUPPRESSIONS}/${id}`, { method: "DELETE" });
    return existing;
}

export async function suppressEmailIfAbsent(email: string, reason: SuppressionReason): Promise<MsSuppressionRow> {
    return addSuppression(email, reason, null, null);
}
