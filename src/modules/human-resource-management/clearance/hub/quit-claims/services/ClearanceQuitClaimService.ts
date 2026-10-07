import { NextResponse } from "next/server";

import {
    QUITCLAIM_SECTION2_SIGNATORY_LABELS,
    QUITCLAIM_STATUSES,
    QuitClaimValuesSchema,
    type QuitClaimStatus,
    type QuitClaimValues,
} from "../types";
import { dFetch } from "../../utils/directus";
import { nowUTC } from "../../utils/audit";
import { allocateDocumentRef, type DocumentRefRow } from "./DocumentRefService";

export const CLEARANCE_QUITCLAIM_ERROR_CODES = {
    invalidInput: "CLEARANCE_QUITCLAIM_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    resignationNotFound: "RESIGNATION_NOT_FOUND",
    quitclaimNotFound: "CLEARANCE_QUITCLAIM_NOT_FOUND",
    quitclaimApproved: "CLEARANCE_QUITCLAIM_APPROVED",
    quitclaimFrozen: "CLEARANCE_QUITCLAIM_FROZEN",
    ownerMismatch: "CLEARANCE_QUITCLAIM_OWNER_MISMATCH",
    refAllocFailed: "DOCUMENT_REF_ALLOC_FAILED",
    writeFailed: "CLEARANCE_QUITCLAIM_WRITE_FAILED",
    readFailed: "CLEARANCE_QUITCLAIM_READ_FAILED",
} as const;

export interface ClearanceQuitclaimRow {
    id: number;
    user_id: number;
    resignation_id: number | null;
    request_id: number | null;
    status: QuitClaimStatus;
    ref_no: string | null;
    clearance_no: string | null;
    company_code: string | null;
    pdf_file: string | null;
    approved_at: string | null;
    approved_by: number | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceQuitclaimDetail extends ClearanceQuitclaimRow {
    values: QuitClaimValues;
}

export interface ClearanceQuitclaimListResult {
    data: ClearanceQuitclaimRow[];
    total: number;
    page: number;
    limit: number;
}

export interface CreateQuitClaimInput {
    userId: number;
    resignationId?: number | null;
    requestId?: number | null;
    companyName?: string;
    actorId: number | null;
}

export interface ApproveQuitClaimInput {
    id: number;
    actorId: number | null;
    companyCode: string;
}

export interface ApproveQuitClaimResult {
    quitclaim: ClearanceQuitclaimRow;
    ref: DocumentRefRow;
    clearanceNo: string;
}

interface RequestRef {
    id: number;
    resignation_id: number;
    user_id: number;
}

interface ItemRef {
    id: number;
    label_snapshot: string;
    department_name_snapshot: string | null;
    remarks: string | null;
    sort_order: number;
}

const QUITCLAIM_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_position,user_department,isDeleted";
const BLANK_ROW = { outlet: "", name: "", date: "", remarks: "" };

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

function toQuitclaimStatus(value: unknown): QuitClaimStatus | null {
    if (typeof value !== "string") return null;
    return (QUITCLAIM_STATUSES as readonly string[]).includes(value) ? (value as QuitClaimStatus) : null;
}

function toFullName(row: Record<string, unknown>): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? "Unnamed team member" : name;
}

function defaultSection2Signatories(): QuitClaimValues["section2_signatories"] {
    return QUITCLAIM_SECTION2_SIGNATORY_LABELS.map((label) => ({ label, name: "", date: "" }));
}

function normalizeQuitclaimRow(raw: unknown): ClearanceQuitclaimRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const userId = toId(raw.user_id);
    const status = toQuitclaimStatus(raw.status);
    if (id === null || userId === null || status === null) return null;
    return {
        id,
        user_id: userId,
        resignation_id: toNullableId(raw.resignation_id),
        request_id: toNullableId(raw.request_id),
        status,
        ref_no: toNullableText(raw.ref_no),
        clearance_no: toNullableText(raw.clearance_no),
        company_code: toNullableText(raw.company_code),
        pdf_file: toNullableText(raw.pdf_file),
        approved_at: toNullableText(raw.approved_at),
        approved_by: toNullableId(raw.approved_by),
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
        updated_at: toNullableText(raw.updated_at),
        updated_by: toNullableId(raw.updated_by),
    };
}

function normalizeValues(raw: unknown): QuitClaimValues | null {
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        if (raw.trim() === "") return null;
        try {
            parsed = JSON.parse(raw) as unknown;
        } catch {
            return null;
        }
    }
    const checked = QuitClaimValuesSchema.safeParse(parsed);
    return checked.success ? checked.data : null;
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${QUITCLAIM_USER_FIELDS}`);
}

async function readRequestRef(id: number): Promise<RequestRef | null> {
    const row = await readSingleOrNull(`/items/clearance_request/${id}?fields=id,resignation_id,user_id`);
    if (!row) return null;
    const rowId = toId(row.id);
    const resignationId = toId(row.resignation_id);
    const userId = toId(row.user_id);
    if (rowId === null || resignationId === null || userId === null) return null;
    return { id: rowId, resignation_id: resignationId, user_id: userId };
}

async function listItemRefs(requestId: number): Promise<ItemRef[]> {
    const body: unknown = await dFetch(
        `/items/clearance_item?filter[request_id][_eq]=${requestId}` +
        `&sort=sort_order,id&limit=-1&fields=id,label_snapshot,department_name_snapshot,remarks,sort_order`
    );
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, "clearance_item read failed");
    }
    const rows: ItemRef[] = [];
    for (const entry of data) {
        if (!isRecord(entry)) continue;
        const id = toId(entry.id);
        const label = toNullableText(entry.label_snapshot);
        if (id === null || label === null) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push({
            id,
            label_snapshot: label,
            department_name_snapshot: toNullableText(entry.department_name_snapshot),
            remarks: toNullableText(entry.remarks),
            sort_order: toId(entry.sort_order) ?? 0,
        });
    }
    return rows;
}

async function readResignationRef(id: number): Promise<{ id: number; user_id: number; resignation_date: string } | null> {
    const row = await readSingleOrNull(
        `/items/resignation_request/${id}?fields=id,user_id,resignation_date`
    );
    if (!row) return null;
    const rowId = toId(row.id);
    const userId = toId(row.user_id);
    if (rowId === null || userId === null) return null;
    return { id: rowId, user_id: userId, resignation_date: toNullableText(row.resignation_date) ?? "" };
}

async function readClearanceRefNo(requestId: number): Promise<string> {
    const body: unknown = await dFetch(
        `/items/clearance_form?filter[request_id][_eq]=${requestId}&fields=ref_no&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data) || body.data.length === 0) return "";
    const first: unknown = body.data[0];
    if (!isRecord(first)) return "";
    return toNullableText(first.ref_no) ?? "";
}

function seedValues(input: {
    employeeName: string;
    position: string;
    separation: string;
    companyName: string;
    items: ItemRef[];
}): QuitClaimValues {
    return {
        identity: {
            date: "",
            name: input.employeeName,
            position: input.position,
            separation: input.separation,
            company: input.companyName,
        },
        accountabilities: input.items.length > 0
            ? input.items.map((item) => ({
                outlet: item.department_name_snapshot ?? item.label_snapshot,
                name: "",
                date: "",
                remarks: item.remarks ?? "",
            }))
            : [{ ...BLANK_ROW }],
        deductions: [{ label: "", amount: "" }],
        due_to_employee: [{ item: "", days: "", amount: "" }],
        totals: { total: "", less_deductions: "", net: "" },
        payment: { amount: "", check_no: "", date: "" },
        released_by: { name: "", title: "", date: "" },
        manager_signature_date: "",
        section2_signatories: defaultSection2Signatories(),
    };
}

export async function createQuitClaim(input: CreateQuitClaimInput): Promise<ClearanceQuitclaimDetail> {
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput, "userId is required");
    }
    const userRow = await readUserRecord(input.userId);
    if (!userRow) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.userNotFound, `user ${input.userId} does not exist`);
    }
    let resignationId: number | null = null;
    let separation = "";
    if (input.resignationId !== undefined && input.resignationId !== null) {
        const resignation = await readResignationRef(input.resignationId);
        if (!resignation) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.resignationNotFound, `resignation_request ${input.resignationId} does not exist`);
        }
        if (resignation.user_id !== input.userId) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.ownerMismatch, "resignation does not belong to this employee");
        }
        resignationId = resignation.id;
        separation = resignation.resignation_date;
    }
    let requestId: number | null = null;
    let items: ItemRef[] = [];
    if (input.requestId !== undefined && input.requestId !== null) {
        const request = await readRequestRef(input.requestId);
        if (!request) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.requestNotFound, `clearance_request ${input.requestId} does not exist`);
        }
        if (request.user_id !== input.userId) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.ownerMismatch, "clearance request does not belong to this employee");
        }
        requestId = request.id;
        items = await listItemRefs(request.id);
        if (resignationId === null) {
            const fallback = await readResignationRef(request.resignation_id);
            if (fallback) {
                resignationId = fallback.id;
                separation = fallback.resignation_date;
            }
        }
    }
    const values = seedValues({
        employeeName: toFullName(userRow),
        position: toNullableText(userRow.user_position) ?? "",
        separation,
        companyName: input.companyName ?? "",
        items,
    });
    const now = nowUTC();
    const body: unknown = await dFetch("/items/clearance_quitclaim", {
        method: "POST",
        body: JSON.stringify({
            user_id: input.userId,
            resignation_id: resignationId,
            request_id: requestId,
            status: "pending",
            ref_no: null,
            clearance_no: null,
            company_code: null,
            values_json: values,
            pdf_file: null,
            approved_at: null,
            approved_by: null,
            created_at: now,
            created_by: input.actorId,
            updated_at: null,
            updated_by: null,
        }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeQuitclaimRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.writeFailed, "clearance_quitclaim create failed");
    }
    return { ...row, values };
}

export async function getQuitClaimByRequest(requestId: number): Promise<ClearanceQuitclaimDetail | null> {
    const body: unknown = await dFetch(
        `/items/clearance_quitclaim?filter[request_id][_eq]=${requestId}&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, "clearance_quitclaim read failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeQuitclaimRow(entry);
        if (!row) continue;
        const values = normalizeValues(isRecord(entry) ? entry.values_json : null);
        if (!values) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, `clearance_quitclaim ${row.id} values_json contract mismatch`);
        }
        return { ...row, values };
    }
    return null;
}

export async function ensureQuitClaim(requestId: number, actorId: number | null): Promise<ClearanceQuitclaimDetail> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const existing = await getQuitClaimByRequest(requestId);
    if (existing) return existing;
    const userRow = await readUserRecord(request.user_id);
    if (!userRow) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.userNotFound, `user ${request.user_id} does not exist`);
    }
    const resignation = await readResignationRef(request.resignation_id);
    const items = await listItemRefs(request.id);
    const values = seedValues({
        employeeName: toFullName(userRow),
        position: toNullableText(userRow.user_position) ?? "",
        separation: resignation ? resignation.resignation_date : "",
        companyName: "",
        items,
    });
    const now = nowUTC();
    try {
        const body: unknown = await dFetch("/items/clearance_quitclaim", {
            method: "POST",
            body: JSON.stringify({
                user_id: request.user_id,
                resignation_id: request.resignation_id,
                request_id: requestId,
                status: "pending",
                ref_no: null,
                clearance_no: null,
                company_code: null,
                values_json: values,
                pdf_file: null,
                approved_at: null,
                approved_by: null,
                created_at: now,
                created_by: actorId,
                updated_at: null,
                updated_by: null,
            }),
        });
        const payload: unknown = isRecord(body) && !Array.isArray(body.data) ? body.data : null;
        const row = payload ? normalizeQuitclaimRow(payload) : null;
        if (row) return { ...row, values };
    } catch {
        const raced = await getQuitClaimByRequest(requestId);
        if (raced) return raced;
    }
    const raced = await getQuitClaimByRequest(requestId);
    if (raced) return raced;
    fail(CLEARANCE_QUITCLAIM_ERROR_CODES.writeFailed, "clearance_quitclaim create failed");
}

export async function getQuitClaim(id: number): Promise<ClearanceQuitclaimDetail> {
    const raw = await readSingleOrNull(`/items/clearance_quitclaim/${id}`);
    const row = raw ? normalizeQuitclaimRow(raw) : null;
    if (!row) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimNotFound, `clearance_quitclaim ${id} does not exist`);
    }
    const values = normalizeValues(raw?.values_json);
    if (!values) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, `clearance_quitclaim ${id} values_json contract mismatch`);
    }
    return { ...row, values };
}

export async function getQuitClaimValues(id: number): Promise<QuitClaimValues> {
    return (await getQuitClaim(id)).values;
}

export async function updateQuitClaimValues(
    id: number,
    values: unknown,
    actorId: number | null
): Promise<ClearanceQuitclaimDetail> {
    const checked = QuitClaimValuesSchema.safeParse(values);
    if (!checked.success) {
        fail(
            CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput,
            `values_json is invalid (${checked.error.issues[0]?.message ?? "unknown"})`
        );
    }
    const current = await getQuitClaim(id);
    if (current.status === "approved") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimApproved, `clearance_quitclaim ${id} is already approved`);
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_quitclaim/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ values_json: checked.data, updated_at: now, updated_by: actorId }),
    });
    const payload: unknown = isRecord(body) && !Array.isArray(body.data) ? body.data : null;
    const row = normalizeQuitclaimRow(payload);
    const nextValues = isRecord(payload) ? normalizeValues(payload.values_json) : null;
    if (!row || !nextValues) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.writeFailed, `clearance_quitclaim/${id} update failed`);
    }
    return { ...row, values: nextValues };
}

export async function approveQuitClaim(input: ApproveQuitClaimInput): Promise<ApproveQuitClaimResult> {
    const companyCode = input.companyCode.trim();
    if (!Number.isInteger(input.id) || input.id <= 0 || companyCode === "") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput, "id and companyCode are required");
    }
    const current = await getQuitClaim(input.id);
    if (current.status === "approved") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimApproved, `clearance_quitclaim ${input.id} is already approved`);
    }
    let ref: DocumentRefRow;
    try {
        ref = await allocateDocumentRef({ documentId: current.id, companyCode, actorId: input.actorId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("DOCUMENT_REF_ALLOC_FAILED")) {
            fail(CLEARANCE_QUITCLAIM_ERROR_CODES.refAllocFailed, message);
        }
        throw error;
    }
    const clearanceNo = current.request_id === null ? "" : await readClearanceRefNo(current.request_id);
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_quitclaim/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            status: "approved",
            ref_no: ref.ref_no,
            clearance_no: clearanceNo === "" ? null : clearanceNo,
            company_code: companyCode,
            approved_at: now,
            approved_by: input.actorId,
            updated_at: now,
            updated_by: input.actorId,
        }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeQuitclaimRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.writeFailed, `clearance_quitclaim/${input.id} approve failed`);
    }
    return { quitclaim: row, ref, clearanceNo };
}

export async function attachQuitClaimPdf(
    id: number,
    pdfFileId: string,
    actorId: number | null
): Promise<ClearanceQuitclaimRow> {
    if (!Number.isInteger(id) || id <= 0 || pdfFileId.trim() === "") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput, "id and pdfFileId are required");
    }
    const current = await getQuitClaim(id);
    if (current.status !== "approved") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimNotFound, `clearance_quitclaim ${id} is not approved`);
    }
    if (current.pdf_file !== null && current.pdf_file !== "") {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimFrozen, `clearance_quitclaim ${id} pdf is frozen`);
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_quitclaim/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pdf_file: pdfFileId, updated_at: now, updated_by: actorId }),
    });
    const row = isRecord(body) && !Array.isArray(body.data) ? normalizeQuitclaimRow(body.data) : null;
    if (!row) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.writeFailed, `clearance_quitclaim/${id} pdf attach failed`);
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

export async function listQuitClaims(query: {
    page?: number;
    limit?: number;
    status?: QuitClaimStatus;
    userId?: number;
}): Promise<ClearanceQuitclaimListResult> {
    const { page, limit } = readPageLimit(query);
    if (query.status !== undefined && !toQuitclaimStatus(query.status)) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput, "status must be pending or approved");
    }
    if (query.userId !== undefined && (!Number.isInteger(query.userId) || query.userId <= 0)) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput, "userId is invalid");
    }
    const filters: string[] = [];
    if (query.status !== undefined) filters.push(`filter[status][_eq]=${query.status}`);
    if (query.userId !== undefined) filters.push(`filter[user_id][_eq]=${query.userId}`);
    filters.push("sort=-id", `limit=${limit}`, `offset=${(page - 1) * limit}`, "meta=total_count");
    const body: unknown = await dFetch(`/items/clearance_quitclaim?${filters.join("&")}`);
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_QUITCLAIM_ERROR_CODES.readFailed, "clearance_quitclaim list failed");
    }
    const rows: ClearanceQuitclaimRow[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeQuitclaimRow(entry);
        if (row) rows.push(row);
    }
    return { data: rows, total: readTotal(body, rows.length), page, limit };
}

export function mapClearanceQuitClaimError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_QUITCLAIM_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_QUITCLAIM_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "Employee not found" },
                { status: 404 }
            );
        case CLEARANCE_QUITCLAIM_ERROR_CODES.resignationNotFound:
            return NextResponse.json(
                { success: false, code, message: "Resignation request not found" },
                { status: 404 }
            );
        case CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimNotFound:
            return NextResponse.json(
                { success: false, code, message: "Quit claim not found" },
                { status: 404 }
            );
        case CLEARANCE_QUITCLAIM_ERROR_CODES.invalidInput:
        case CLEARANCE_QUITCLAIM_ERROR_CODES.ownerMismatch:
        case "DOCUMENT_REF_INVALID_INPUT":
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimApproved:
        case CLEARANCE_QUITCLAIM_ERROR_CODES.quitclaimFrozen:
        case CLEARANCE_QUITCLAIM_ERROR_CODES.refAllocFailed:
        case "DOCUMENT_REF_ALLOC_FAILED":
            return NextResponse.json({ success: false, code, message: "The quit claim cannot be approved" }, { status: 409 });
        default:
            return null;
    }
}
