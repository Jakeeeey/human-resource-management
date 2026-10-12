import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
    ClearanceCategorySchema,
    ClearanceCategorySignatorySchema,
    ClearanceTemplateSchema,
    type ClearanceCategory,
    type ClearanceCategorySignatory,
    type ClearanceTemplate,
} from "../types";
import { nowUTC } from "../utils/audit";
import { dFetch } from "../utils/directus";

export const CLEARANCE_TEMPLATE_ERROR_CODES = {
    rowExists: "CLEARANCE_TEMPLATE_EXISTS",
    rowNotFound: "CLEARANCE_TEMPLATE_NOT_FOUND",
    templateInUse: "CLEARANCE_TEMPLATE_IN_USE",
    poolRequired: "POOL_REQUIRED",
    readFailed: "CLEARANCE_TEMPLATE_READ_FAILED",
    writeFailed: "CLEARANCE_TEMPLATE_WRITE_FAILED",
} as const;

export type ClearanceTemplateErrorCode =
    (typeof CLEARANCE_TEMPLATE_ERROR_CODES)[keyof typeof CLEARANCE_TEMPLATE_ERROR_CODES];

export interface ClearanceTemplateWriteRow {
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

export interface ClearanceCategoryWriteRow {
    template_id: number;
    label: string;
    instructions: string | null;
    signer_type: string;
    department_id: number | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

export interface ClearanceCategorySignatoryWriteRow {
    category_id: number;
    user_id: number;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    created_by: number | null;
    updated_at: string;
    updated_by: number | null;
}

export function unauthorized(): NextResponse {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export function validationFailed(errors: Record<string, string[] | undefined>): NextResponse {
    return NextResponse.json({ success: false, message: "Validation failed", errors }, { status: 400 });
}

export function serverError(): NextResponse {
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

export function invalidId(): NextResponse {
    return NextResponse.json({ success: false, message: "Invalid id" }, { status: 400 });
}

export function clearanceError(status: number, code: ClearanceTemplateErrorCode, message: string): NextResponse {
    return NextResponse.json({ success: false, code, message }, { status });
}

export function clearanceConflict(code: ClearanceTemplateErrorCode, message: string): NextResponse {
    return clearanceError(409, code, message);
}

export function clearanceNotFound(message: string): NextResponse {
    return clearanceError(404, CLEARANCE_TEMPLATE_ERROR_CODES.rowNotFound, message);
}

export function readAllFlag(req: NextRequest): boolean {
    return req.nextUrl.searchParams.get("all") === "1";
}

export function parseRouteId(raw: string): number | null {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export function nextSortOrder(rows: ReadonlyArray<{ sort_order: number }>): number {
    let max = 0;
    for (const row of rows) {
        if (row.sort_order > max) max = row.sort_order;
    }
    return max + 10;
}

export function assertClearanceOrderEntriesExist(
    existingIds: ReadonlySet<number>,
    entries: ReadonlyArray<{ id: number }>
): void {
    const missing = entries.filter((entry) => !existingIds.has(entry.id)).map((entry) => entry.id);
    if (missing.length > 0) {
        fail(CLEARANCE_TEMPLATE_ERROR_CODES.rowNotFound, `unknown id(s) ${missing.join(",")}`);
    }
}

export function assertPoolSigner(signerType: string): void {
    if (signerType !== "pool") {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.poolRequired,
            "Signatories can only be managed for categories with signer_type \"pool\""
        );
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
            CLEARANCE_TEMPLATE_ERROR_CODES.readFailed,
            `${label} row contract mismatch (${JSON.stringify(parsed.error.flatten())})`
        );
    }
    return parsed.data;
}

function parseRowList<T>(schema: z.ZodType<T>, body: unknown, label: string): T[] {
    const envelope = z.object({ data: z.array(z.unknown()) }).safeParse(body);
    if (!envelope.success) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.readFailed,
            `${label} read failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return envelope.data.data.map((raw) => parseRow(schema, raw, label));
}

function parseSingle<T>(schema: z.ZodType<T>, body: unknown, label: string): T {
    const envelope = z.object({ data: z.unknown() }).safeParse(body);
    if (!envelope.success) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.writeFailed,
            `${label} write/read failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return parseRow(schema, envelope.data.data, label);
}

export async function listClearanceTemplates(
    options: { activeOnly?: boolean } = {}
): Promise<ClearanceTemplate[]> {
    const query = ["sort=sort_order,id", "limit=-1"];
    if (options.activeOnly === true) {
        query.push("filter[is_active][_eq]=1");
    }
    const body: unknown = await dFetch(`/items/clearance_template?${query.join("&")}`);
    return parseRowList(ClearanceTemplateSchema, body, "clearance_template");
}

export async function getClearanceTemplate(id: number): Promise<ClearanceTemplate | null> {
    const rows = await listClearanceTemplates();
    return rows.find((row) => row.id === id) ?? null;
}

export async function findClearanceTemplateIdByCode(code: string): Promise<number | null> {
    const body: unknown = await dFetch(
        `/items/clearance_template?filter[code][_eq]=${encodeURIComponent(code)}&fields=id&limit=1`
    );
    const parsed = z
        .object({ data: z.array(z.object({ id: z.number().int().positive() })) })
        .safeParse(body);
    if (!parsed.success) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.readFailed,
            `clearance_template code lookup failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return parsed.data.data[0]?.id ?? null;
}

export async function createClearanceTemplateRow(row: ClearanceTemplateWriteRow): Promise<ClearanceTemplate> {
    const body: unknown = await dFetch("/items/clearance_template", {
        method: "POST",
        body: JSON.stringify([row]),
    });
    const created = parseRowList(ClearanceTemplateSchema, body, "clearance_template create");
    if (created.length === 0) {
        fail(CLEARANCE_TEMPLATE_ERROR_CODES.writeFailed, "clearance_template create returned no rows");
    }
    return created[0];
}

export async function patchClearanceTemplateRow(
    id: number,
    patch: Record<string, unknown>
): Promise<ClearanceTemplate> {
    const body: unknown = await dFetch(`/items/clearance_template/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    return parseSingle(ClearanceTemplateSchema, body, `clearance_template/${id} update`);
}

export async function softDeleteClearanceTemplateRow(
    id: number,
    actorId: number | null
): Promise<ClearanceTemplate> {
    return patchClearanceTemplateRow(id, {
        is_active: 0,
        updated_at: nowUTC(),
        updated_by: actorId,
    });
}

export async function listClearanceCategories(
    templateId: number,
    options: { activeOnly?: boolean } = {}
): Promise<ClearanceCategory[]> {
    const query = [`filter[template_id][_eq]=${templateId}`, "sort=sort_order,id", "limit=-1"];
    if (options.activeOnly === true) {
        query.push("filter[is_active][_eq]=1");
    }
    const body: unknown = await dFetch(`/items/clearance_category?${query.join("&")}`);
    return parseRowList(ClearanceCategorySchema, body, "clearance_category");
}

export async function getClearanceCategory(id: number): Promise<ClearanceCategory | null> {
    const body: unknown = await dFetch(`/items/clearance_category?filter[id][_eq]=${id}&limit=1`);
    const rows = parseRowList(ClearanceCategorySchema, body, "clearance_category");
    return rows[0] ?? null;
}

export async function createClearanceCategoryRows(
    rows: ReadonlyArray<ClearanceCategoryWriteRow>
): Promise<ClearanceCategory[]> {
    const body: unknown = await dFetch("/items/clearance_category", {
        method: "POST",
        body: JSON.stringify(rows),
    });
    return parseRowList(ClearanceCategorySchema, body, "clearance_category create");
}

export async function patchClearanceCategoryRow(
    id: number,
    patch: Record<string, unknown>
): Promise<ClearanceCategory> {
    const body: unknown = await dFetch(`/items/clearance_category/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    return parseSingle(ClearanceCategorySchema, body, `clearance_category/${id} update`);
}

export async function softDeleteClearanceCategoryRow(
    id: number,
    actorId: number | null
): Promise<ClearanceCategory> {
    return patchClearanceCategoryRow(id, {
        is_active: 0,
        updated_at: nowUTC(),
        updated_by: actorId,
    });
}

export async function reorderClearanceCategories(
    entries: ReadonlyArray<{ id: number; sort_order: number }>,
    actorId: number | null
): Promise<ClearanceCategory[]> {
    const now = nowUTC();
    const updated: ClearanceCategory[] = [];
    for (const entry of entries) {
        updated.push(
            await patchClearanceCategoryRow(entry.id, {
                sort_order: entry.sort_order,
                updated_at: now,
                updated_by: actorId,
            })
        );
    }
    return updated;
}

export async function listClearanceCategorySignatories(
    categoryId: number
): Promise<ClearanceCategorySignatory[]> {
    const body: unknown = await dFetch(
        `/items/clearance_category_signatory?filter[category_id][_eq]=${categoryId}&sort=sort_order,id&limit=-1`
    );
    return parseRowList(ClearanceCategorySignatorySchema, body, "clearance_category_signatory");
}

export async function replaceClearanceCategorySignatories(
    categoryId: number,
    userIds: number[],
    actorId: number | null
): Promise<ClearanceCategorySignatory[]> {
    const current = await listClearanceCategorySignatories(categoryId);
    for (const row of current) {
        await hardDeleteClearanceItem("clearance_category_signatory", row.id);
    }
    const uniqueUserIds = [...new Set(userIds)];
    const now = nowUTC();
    const writes: ClearanceCategorySignatoryWriteRow[] = uniqueUserIds.map((userId, index) => ({
        category_id: categoryId,
        user_id: userId,
        sort_order: (index + 1) * 10,
        is_active: true,
        created_at: now,
        created_by: actorId,
        updated_at: now,
        updated_by: actorId,
    }));
    const body: unknown = await dFetch("/items/clearance_category_signatory", {
        method: "POST",
        body: JSON.stringify(writes),
    });
    return parseRowList(ClearanceCategorySignatorySchema, body, "clearance_category_signatory create");
}

const CountEnvelopeSchema = z.object({
    data: z.array(
        z.object({
            count: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]),
        })
    ),
});

async function countReferences(collection: string, field: string, id: number): Promise<number> {
    const body: unknown = await dFetch(
        `/items/${collection}?filter[${field}][_eq]=${id}&aggregate[count]=*`
    );
    const parsed = CountEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.readFailed,
            `${collection} reference count failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
    return parsed.data.data[0]?.count ?? 0;
}

export function countRequestReferencesByTemplate(templateId: number): Promise<number> {
    return countReferences("clearance_request", "template_id", templateId);
}

export function countItemReferencesByCategory(categoryId: number): Promise<number> {
    return countReferences("clearance_item", "category_id", categoryId);
}

export async function assertClearanceTemplateNotReferenced(templateId: number): Promise<void> {
    const references = await countRequestReferencesByTemplate(templateId);
    if (references > 0) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.templateInUse,
            `template ${templateId} is referenced by ${references} clearance request(s)`
        );
    }
}

export async function assertClearanceCategoryNotReferenced(categoryId: number): Promise<void> {
    const references = await countItemReferencesByCategory(categoryId);
    if (references > 0) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.templateInUse,
            `category ${categoryId} is referenced by ${references} clearance item(s)`
        );
    }
}

export async function hardDeleteClearanceItem(collection: string, id: number): Promise<void> {
    const body: unknown = await dFetch(`/items/${collection}/${id}`, {
        method: "DELETE",
    });
    if (body !== null) {
        fail(
            CLEARANCE_TEMPLATE_ERROR_CODES.writeFailed,
            `${collection}/${id} hard delete failed (${JSON.stringify(body).slice(0, 300)})`
        );
    }
}

function codedDetail(message: string, code: string): string {
    const prefix = `${code}: `;
    return message.startsWith(prefix) ? message.slice(prefix.length) : message;
}

export function mapClearanceTemplateFailure(error: unknown): NextResponse {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(CLEARANCE_TEMPLATE_ERROR_CODES.templateInUse)) {
        return clearanceConflict(
            CLEARANCE_TEMPLATE_ERROR_CODES.templateInUse,
            `This row cannot be hard-deleted (${codedDetail(
                message,
                CLEARANCE_TEMPLATE_ERROR_CODES.templateInUse
            )}). Deactivate it instead.`
        );
    }
    if (message.includes(CLEARANCE_TEMPLATE_ERROR_CODES.poolRequired)) {
        return clearanceConflict(
            CLEARANCE_TEMPLATE_ERROR_CODES.poolRequired,
            codedDetail(message, CLEARANCE_TEMPLATE_ERROR_CODES.poolRequired)
        );
    }
    if (message.includes(CLEARANCE_TEMPLATE_ERROR_CODES.rowNotFound)) {
        return clearanceNotFound("One or more rows do not exist");
    }
    if (message.includes("RECORD_NOT_UNIQUE") || message.toLowerCase().includes("duplicate entry")) {
        return clearanceConflict(
            CLEARANCE_TEMPLATE_ERROR_CODES.rowExists,
            "A template with the same code already exists"
        );
    }
    return serverError();
}
