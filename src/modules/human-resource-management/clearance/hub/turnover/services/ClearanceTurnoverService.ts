import { NextResponse } from "next/server";

import {
    createEmptyTurnoverData,
    normalizeTurnoverData,
    type ClearanceTurnoverRow,
    type TurnoverData,
    type TurnoverStatus,
} from "../types";
import { dFetch } from "../../utils/directus";
import { nowUTC } from "../../utils/audit";
import { allocateDocumentRef, type DocumentRefRow } from "./DocumentRefService";
import { syncClearanceRequestCompletion } from "../../services/ClearanceRequestService";

export const CLEARANCE_TURNOVER_ERROR_CODES = {
    invalidInput: "CLEARANCE_TURNOVER_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    turnoverNotFound: "CLEARANCE_TURNOVER_NOT_FOUND",
    turnoverApproved: "CLEARANCE_TURNOVER_APPROVED",
    turnoverFrozen: "CLEARANCE_TURNOVER_FROZEN",
    uploadMissing: "CLEARANCE_TURNOVER_UPLOAD_MISSING",
    refAllocFailed: "DOCUMENT_REF_ALLOC_FAILED",
    writeFailed: "CLEARANCE_TURNOVER_WRITE_FAILED",
    readFailed: "CLEARANCE_TURNOVER_READ_FAILED",
} as const;

export const TURNOVER_STATUSES = ["pending", "approved"] as const;

export interface ClearanceTurnoverDetail extends ClearanceTurnoverRow {
    created_by: number | null;
    updated_by: number | null;
}

export interface ClearanceTurnoverSummaryRow {
    id: number;
    request_id: number;
    status: TurnoverStatus;
    ref_no: string | null;
    pdf_file: string | null;
    approved_at: string | null;
    approved_by: number | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface ClearanceTurnoverListResult {
    data: ClearanceTurnoverSummaryRow[];
    total: number;
    page: number;
    limit: number;
}

export interface CreateTurnoverInput {
    requestId: number;
    actorId: number | null;
}

export interface ApproveTurnoverInput {
    id: number;
    actorId: number | null;
    companyCode: string;
}

export interface ApproveTurnoverResult {
    turnover: ClearanceTurnoverDetail;
    ref: DocumentRefRow;
}

interface RequestRef {
    id: number;
    user_id: number;
}

interface TurnoverRef {
    id: number;
    request_id: number;
    status: TurnoverStatus;
    ref_no: string | null;
    pdf_file: string | null;
}

const TURNOVER_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_position,isDeleted";

function fail(code: string, detail: string): never {
    throw new Error(`${code}: ${detail}`);
}

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

function toNullableId(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return toId(value);
}

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

function toTurnoverStatus(value: unknown): TurnoverStatus | null {
    if (typeof value !== "string") return null;
    return (TURNOVER_STATUSES as readonly string[]).includes(value) ? (value as TurnoverStatus) : null;
}

function toFullName(row: Record<string, unknown>): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? "Unnamed team member" : name;
}

function normalizeTurnoverRow(raw: unknown): ClearanceTurnoverDetail | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toTurnoverStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        pdf_file: toNullableText(raw.pdf_file),
        data: normalizeTurnoverData(raw.data_json),
        approved_at: toNullableText(raw.approved_at),
        approved_by: toNullableId(raw.approved_by),
        created_at: toNullableText(raw.created_at),
        updated_at: toNullableText(raw.updated_at),
        created_by: toNullableId(raw.created_by),
        updated_by: toNullableId(raw.updated_by),
    };
}

function normalizeSummaryRow(raw: unknown): ClearanceTurnoverSummaryRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toTurnoverStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        pdf_file: toNullableText(raw.pdf_file),
        approved_at: toNullableText(raw.approved_at),
        approved_by: toNullableId(raw.approved_by),
        created_at: toNullableText(raw.created_at),
        updated_at: toNullableText(raw.updated_at),
    };
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readRequestRef(id: number): Promise<RequestRef | null> {
    const row = await readSingleOrNull(`/items/clearance_request/${id}?fields=id,user_id`);
    if (!row) return null;
    const rowId = toId(row.id);
    const userId = toId(row.user_id);
    if (rowId === null || userId === null) return null;
    return { id: rowId, user_id: userId };
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${TURNOVER_USER_FIELDS}`);
}

function seedTurnoverData(userRow: Record<string, unknown>): TurnoverData {
    const data = createEmptyTurnoverData();
    const name = toFullName(userRow);
    data.general.employee_name = name;
    data.general.position = toNullableText(userRow.user_position) ?? "";
    const department = toNullableText(userRow.user_department);
    data.general.department = department ?? "";
    data.certification.employee_name = name;
    return data;
}

export async function getTurnoverByRequest(requestId: number): Promise<ClearanceTurnoverDetail | null> {
    const body: unknown = await dFetch(
        `/items/clearance_turnover?filter[request_id][_eq]=${requestId}` +
        `&sort=-id&limit=1&fields=id,request_id,status,ref_no,pdf_file,data_json,approved_at,approved_by,created_at,created_by,updated_at,updated_by`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.readFailed, "clearance_turnover read failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeTurnoverRow(entry);
        if (row) return row;
    }
    return null;
}

export async function getTurnover(id: number): Promise<ClearanceTurnoverDetail> {
    const raw = await readSingleOrNull(`/items/clearance_turnover/${id}`);
    const row = raw ? normalizeTurnoverRow(raw) : null;
    if (!row) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.turnoverNotFound, `clearance_turnover ${id} does not exist`);
    }
    return row;
}

export async function getTurnoverPdfFileId(id: number): Promise<string | null> {
    const row = await readSingleOrNull(`/items/clearance_turnover/${id}?fields=id,pdf_file`);
    if (!row) return null;
    return toNullableText(row.pdf_file);
}

export async function readTurnoverRef(id: number): Promise<TurnoverRef | null> {
    const raw = await readSingleOrNull(
        `/items/clearance_turnover/${id}?fields=id,request_id,status,ref_no,pdf_file`
    );
    if (!raw) return null;
    const rowId = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toTurnoverStatus(raw.status);
    if (rowId === null || requestId === null || status === null) return null;
    return {
        id: rowId,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        pdf_file: toNullableText(raw.pdf_file),
    };
}

export async function createTurnover(input: CreateTurnoverInput): Promise<ClearanceTurnoverDetail> {
    if (!Number.isInteger(input.requestId) || input.requestId <= 0) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "requestId is required");
    }
    const request = await readRequestRef(input.requestId);
    if (!request) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.requestNotFound, `clearance_request ${input.requestId} does not exist`);
    }
    const existing = await getTurnoverByRequest(input.requestId);
    if (existing) return existing;
    const userRow = await readUserRecord(request.user_id);
    if (!userRow) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.userNotFound, `user ${request.user_id} does not exist`);
    }
    const data = seedTurnoverData(userRow);
    const now = nowUTC();
    try {
        const body: unknown = await dFetch("/items/clearance_turnover", {
            method: "POST",
            body: JSON.stringify({
                request_id: request.id,
                status: "pending",
                ref_no: null,
                pdf_file: null,
                data_json: JSON.stringify(data),
                approved_at: null,
                approved_by: null,
                created_at: now,
                created_by: input.actorId,
                updated_at: null,
                updated_by: null,
            }),
        });
        const payload: unknown = isRecord(body) && !Array.isArray(body.data) ? body.data : null;
        const row = payload ? normalizeTurnoverRow(payload) : null;
        if (row) return row;
    } catch {
        const raced = await getTurnoverByRequest(input.requestId);
        if (raced) return raced;
    }
    const raced = await getTurnoverByRequest(input.requestId);
    if (raced) return raced;
    fail(CLEARANCE_TURNOVER_ERROR_CODES.writeFailed, "clearance_turnover create failed");
}

export async function updateTurnoverData(
    id: number,
    raw: unknown,
    actorId: number | null
): Promise<ClearanceTurnoverDetail> {
    if (!Number.isInteger(id) || id <= 0) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "id is required");
    }
    if (raw === null || raw === undefined) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "data is required");
    }
    const current = await getTurnover(id);
    if (current.status === "approved") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.turnoverApproved, `clearance_turnover ${id} is already approved`);
    }
    const data = normalizeTurnoverData(raw);
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_turnover/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
            data_json: JSON.stringify(data),
            updated_at: now,
            updated_by: actorId,
        }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeTurnoverRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.writeFailed, `clearance_turnover/${id} update failed`);
    }
    return row;
}

export async function approveTurnover(input: ApproveTurnoverInput): Promise<ApproveTurnoverResult> {
    const companyCode = input.companyCode.trim();
    if (!Number.isInteger(input.id) || input.id <= 0 || companyCode === "") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "id and companyCode are required");
    }
    const current = await getTurnover(input.id);
    if (current.status === "approved") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.turnoverApproved, `clearance_turnover ${input.id} is already approved`);
    }
    if (current.pdf_file === null || current.pdf_file === "") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.uploadMissing, `clearance_turnover ${input.id} has no uploaded PDF`);
    }
    let ref: DocumentRefRow;
    try {
        ref = await allocateDocumentRef({ documentId: current.id, companyCode, actorId: input.actorId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("DOCUMENT_REF_ALLOC_FAILED")) {
            fail(CLEARANCE_TURNOVER_ERROR_CODES.refAllocFailed, message);
        }
        throw error;
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_turnover/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            status: "approved",
            ref_no: ref.ref_no,
            approved_at: now,
            approved_by: input.actorId,
            updated_at: now,
            updated_by: input.actorId,
        }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeTurnoverRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.writeFailed, `clearance_turnover/${input.id} approve failed`);
    }
    await syncClearanceRequestCompletion(row.request_id, input.actorId).catch(() => undefined);
    return { turnover: row, ref };
}

export async function attachTurnoverPdf(
    id: number,
    pdfFileId: string,
    actorId: number | null
): Promise<ClearanceTurnoverDetail> {
    if (!Number.isInteger(id) || id <= 0 || pdfFileId.trim() === "") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "id and pdfFileId are required");
    }
    const current = await getTurnover(id);
    if (current.status === "approved" && current.pdf_file !== null && current.pdf_file !== "") {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.turnoverFrozen, `clearance_turnover ${id} pdf is frozen`);
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_turnover/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pdf_file: pdfFileId, updated_at: now, updated_by: actorId }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeTurnoverRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.writeFailed, `clearance_turnover/${id} pdf attach failed`);
    }
    return row;
}

function readPageLimit(query: { page?: number; limit?: number }): { page: number; limit: number } {
    const page = query.page !== undefined && Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = query.limit !== undefined && Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : 25;
    return { page, limit };
}

function readTotal(body: unknown, fallback: number): number {
    const meta: unknown = isRecord(body) ? body.meta : null;
    const total = isRecord(meta) ? toId(meta.total_count) : null;
    return total ?? fallback;
}

export async function listTurnovers(query: {
    page?: number;
    limit?: number;
    status?: TurnoverStatus;
    requestId?: number;
}): Promise<ClearanceTurnoverListResult> {
    const { page, limit } = readPageLimit(query);
    if (query.status !== undefined && !toTurnoverStatus(query.status)) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "status must be pending or approved");
    }
    if (query.requestId !== undefined && (!Number.isInteger(query.requestId) || query.requestId <= 0)) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.invalidInput, "requestId is invalid");
    }
    const filters: string[] = [];
    if (query.status !== undefined) filters.push(`filter[status][_eq]=${query.status}`);
    if (query.requestId !== undefined) filters.push(`filter[request_id][_eq]=${query.requestId}`);
    filters.push("sort=-id", `limit=${limit}`, `offset=${(page - 1) * limit}`, "meta=total_count");
    filters.push("fields=id,request_id,status,ref_no,pdf_file,approved_at,approved_by,created_at,updated_at");
    const body: unknown = await dFetch(`/items/clearance_turnover?${filters.join("&")}`);
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_TURNOVER_ERROR_CODES.readFailed, "clearance_turnover list failed");
    }
    const rows: ClearanceTurnoverSummaryRow[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeSummaryRow(entry);
        if (row) rows.push(row);
    }
    return { data: rows, total: readTotal(body, rows.length), page, limit };
}

export function mapClearanceTurnoverError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_TURNOVER_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_TURNOVER_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "Employee not found" },
                { status: 404 }
            );
        case CLEARANCE_TURNOVER_ERROR_CODES.turnoverNotFound:
            return NextResponse.json(
                { success: false, code, message: "Turnover checklist not found" },
                { status: 404 }
            );
        case CLEARANCE_TURNOVER_ERROR_CODES.invalidInput:
        case "DOCUMENT_REF_INVALID_INPUT":
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_TURNOVER_ERROR_CODES.turnoverApproved:
        case CLEARANCE_TURNOVER_ERROR_CODES.turnoverFrozen:
        case CLEARANCE_TURNOVER_ERROR_CODES.refAllocFailed:
        case "DOCUMENT_REF_ALLOC_FAILED":
            return NextResponse.json(
                { success: false, code, message: "The turnover checklist cannot be approved" },
                { status: 409 }
            );
        case CLEARANCE_TURNOVER_ERROR_CODES.uploadMissing:
            return NextResponse.json(
                { success: false, code, message: "Upload the turnover checklist PDF to the 201 file before approving" },
                { status: 409 }
            );
        default:
            return null;
    }
}
