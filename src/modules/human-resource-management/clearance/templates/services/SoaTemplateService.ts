import { NextResponse } from "next/server";
import { z } from "zod";

import {
    SoaTemplateRowSchema,
    SoaTemplateSchema,
    type SoaTemplate,
    type SoaTemplateRow,
} from "../types";
import { nowUTC } from "../utils/audit";
import { dFetch } from "../utils/directus";

export const SOA_TEMPLATE_ERROR_CODES = {
    rowExists: "SOA_TEMPLATE_EXISTS",
    rowNotFound: "SOA_TEMPLATE_NOT_FOUND",
    readFailed: "SOA_TEMPLATE_READ_FAILED",
    writeFailed: "SOA_TEMPLATE_WRITE_FAILED",
} as const;

export type SoaTemplateErrorCode =
    (typeof SOA_TEMPLATE_ERROR_CODES)[keyof typeof SOA_TEMPLATE_ERROR_CODES];

export interface SoaTemplateWriteRow {
    code: string;
    title: string;
    description: string | null;
    department_id: number | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

export interface SoaTemplateRowWriteRow {
    template_id: number;
    label: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

export function soaTemplateError(status: number, code: SoaTemplateErrorCode, message: string): NextResponse {
    return NextResponse.json({ success: false, code, message }, { status });
}

export function soaTemplateConflict(code: SoaTemplateErrorCode, message: string): NextResponse {
    return soaTemplateError(409, code, message);
}

export function soaTemplateNotFound(message: string): NextResponse {
    return soaTemplateError(404, SOA_TEMPLATE_ERROR_CODES.rowNotFound, message);
}

export function nextSoaTemplateSortOrder(rows: ReadonlyArray<{ sort_order: number }>): number {
    let max = 0;
    for (const row of rows) {
        if (row.sort_order > max) max = row.sort_order;
    }
    return max + 10;
}

export function assertSoaTemplateOrderEntriesExist(
    existingIds: ReadonlySet<number>,
    entries: ReadonlyArray<{ id: number }>
): void {
    const missing = entries.filter((entry) => !existingIds.has(entry.id)).map((entry) => entry.id);
    if (missing.length > 0) {
        fail(SOA_TEMPLATE_ERROR_CODES.rowNotFound, `unknown id(s) ${missing.join(",")}`);
    }
}

function fail(code: string, detail: string): never {
    throw new Error(`${code}: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function normalizeActiveFlag(raw: Record<string, unknown>): Record<string, unknown> {
    if (typeof raw.is_active === "number") {
        return { ...raw, is_active: raw.is_active === 1 };
    }
    return raw;
}

function parseRow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
    const normalized = isRecord(raw) ? normalizeActiveFlag(raw) : raw;
    const parsed = schema.safeParse(normalized);
    if (!parsed.success) {
        fail(
            SOA_TEMPLATE_ERROR_CODES.readFailed,
            `${label} row contract mismatch (${JSON.stringify(parsed.error.flatten())})`
        );
    }
    return parsed.data;
}

function parseRowList<T>(schema: z.ZodType<T>, body: unknown, label: string): T[] {
    const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
    if (!envelope.success) {
        fail(
            SOA_TEMPLATE_ERROR_CODES.readFailed,
            `${label} read failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return envelope.data.data.map((raw) => parseRow(schema, raw, label));
}

function parseSingle<T>(schema: z.ZodType<T>, body: unknown, label: string): T {
    const envelope = z.object({ data: z.unknown() }).safeParse(body);
    if (!envelope.success) {
        fail(
            SOA_TEMPLATE_ERROR_CODES.writeFailed,
            `${label} write/read failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return parseRow(schema, envelope.data.data, label);
}

export async function listSoaTemplates(
    options: { activeOnly?: boolean } = {}
): Promise<SoaTemplate[]> {
    const query = ["sort=sort_order,id", "limit=-1"];
    if (options.activeOnly === true) {
        query.push("filter[is_active][_eq]=1");
    }
    const body: unknown = await dFetch(`/items/clearance_soa_template?${query.join("&")}`);
    return parseRowList(SoaTemplateSchema, body, "clearance_soa_template");
}

export async function getSoaTemplate(id: number): Promise<SoaTemplate | null> {
    const rows = await listSoaTemplates();
    return rows.find((row) => row.id === id) ?? null;
}

export async function findSoaTemplateIdByCode(code: string): Promise<number | null> {
    const body: unknown = await dFetch(
        `/items/clearance_soa_template?filter[code][_eq]=${encodeURIComponent(code)}&fields=id&limit=1`
    );
    const parsed = z
        .object({ data: z.array(z.object({ id: z.number().int().positive() })) })
        .safeParse(body);
    if (!parsed.success) {
        fail(
            SOA_TEMPLATE_ERROR_CODES.readFailed,
            `clearance_soa_template code lookup failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return parsed.data.data[0]?.id ?? null;
}

export async function createSoaTemplateRow(row: SoaTemplateWriteRow): Promise<SoaTemplate> {
    const body: unknown = await dFetch("/items/clearance_soa_template", {
        method: "POST",
        body: JSON.stringify([row]),
    });
    const created = parseRowList(SoaTemplateSchema, body, "clearance_soa_template create");
    if (created.length === 0) {
        fail(SOA_TEMPLATE_ERROR_CODES.writeFailed, "clearance_soa_template create returned no rows");
    }
    return created[0];
}

export async function patchSoaTemplateRow(
    id: number,
    patch: Record<string, unknown>
): Promise<SoaTemplate> {
    const body: unknown = await dFetch(`/items/clearance_soa_template/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    return parseSingle(SoaTemplateSchema, body, `clearance_soa_template/${id} update`);
}

export async function softDeleteSoaTemplateRow(
    id: number,
    actorId: number | null
): Promise<SoaTemplate> {
    return patchSoaTemplateRow(id, {
        is_active: 0,
        updated_at: nowUTC(),
        updated_by: actorId,
    });
}

export async function listSoaTemplateRows(
    templateId: number,
    options: { activeOnly?: boolean } = {}
): Promise<SoaTemplateRow[]> {
    const query = [`filter[template_id][_eq]=${templateId}`, "sort=sort_order,id", "limit=-1"];
    if (options.activeOnly === true) {
        query.push("filter[is_active][_eq]=1");
    }
    const body: unknown = await dFetch(`/items/clearance_soa_template_row?${query.join("&")}`);
    return parseRowList(SoaTemplateRowSchema, body, "clearance_soa_template_row");
}

export async function getSoaTemplateRow(id: number): Promise<SoaTemplateRow | null> {
    const body: unknown = await dFetch(`/items/clearance_soa_template_row?filter[id][_eq]=${id}&limit=1`);
    const rows = parseRowList(SoaTemplateRowSchema, body, "clearance_soa_template_row");
    return rows[0] ?? null;
}

export async function createSoaTemplateRowRows(
    rows: ReadonlyArray<SoaTemplateRowWriteRow>
): Promise<SoaTemplateRow[]> {
    const body: unknown = await dFetch("/items/clearance_soa_template_row", {
        method: "POST",
        body: JSON.stringify(rows),
    });
    return parseRowList(SoaTemplateRowSchema, body, "clearance_soa_template_row create");
}

export async function patchSoaTemplateRowRow(
    id: number,
    patch: Record<string, unknown>
): Promise<SoaTemplateRow> {
    const body: unknown = await dFetch(`/items/clearance_soa_template_row/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    return parseSingle(SoaTemplateRowSchema, body, `clearance_soa_template_row/${id} update`);
}

export async function softDeleteSoaTemplateRowRow(
    id: number,
    actorId: number | null
): Promise<SoaTemplateRow> {
    return patchSoaTemplateRowRow(id, {
        is_active: 0,
        updated_at: nowUTC(),
        updated_by: actorId,
    });
}

export async function reorderSoaTemplateRows(
    entries: ReadonlyArray<{ id: number; sort_order: number }>,
    actorId: number | null
): Promise<SoaTemplateRow[]> {
    const now = nowUTC();
    const updated: SoaTemplateRow[] = [];
    for (const entry of entries) {
        updated.push(
            await patchSoaTemplateRowRow(entry.id, {
                sort_order: entry.sort_order,
                updated_at: now,
                updated_by: actorId,
            })
        );
    }
    return updated;
}

export function mapSoaTemplateFailure(error: unknown): NextResponse {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(SOA_TEMPLATE_ERROR_CODES.rowNotFound)) {
        return soaTemplateNotFound("One or more rows do not exist");
    }
    if (message.includes("RECORD_NOT_UNIQUE") || message.toLowerCase().includes("duplicate entry")) {
        return soaTemplateConflict(
            SOA_TEMPLATE_ERROR_CODES.rowExists,
            "An SOA template with the same code already exists"
        );
    }
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}
