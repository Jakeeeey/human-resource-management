import { NextResponse } from "next/server";

import { CLEARANCE_SIGNER_TYPES, type ClearanceSignerType } from "../types";
import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";

export const CLEARANCE_FILING_ERROR_CODES = {
    invalidInput: "CLEARANCE_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    itemNotFound: "CLEARANCE_ITEM_NOT_FOUND",
    requestCompleted: "REQUEST_COMPLETED",
    itemSigned: "ITEM_SIGNED",
    notInCandidateSet: "SIGNER_NOT_IN_SET",
    subjectSelfSign: "SUBJECT_SELF_SIGN",
    noPick: "NO_PICK",
    substitutionReasonRequired: "SUBSTITUTION_REASON_REQUIRED",
    writeFailed: "CLEARANCE_WRITE_FAILED",
    readFailed: "CLEARANCE_READ_FAILED",
} as const;

export interface ClearanceFilingRequestRow {
    id: number;
    resignation_id: number;
    user_id: number;
    template_id: number;
    template_code_snapshot: string | null;
    template_title_snapshot: string | null;
    status: string;
    confirmed_by: number | null;
    confirmed_at: string | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceFilingItemRow {
    id: number;
    request_id: number;
    category_id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    signer_type_snapshot: ClearanceSignerType;
    department_id_snapshot: number | null;
    department_name_snapshot: string | null;
    sort_order: number;
    status: string;
    expected_signer_user_id: number | null;
    signed_by_user_id: number | null;
    captured_by_user_id: number | null;
    substitution_reason: string | null;
    signature_strokes: string | null;
    remarks: string | null;
    signed_at: string | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceFilingRequestDetail extends ClearanceFilingRequestRow {
    items: ClearanceFilingItemRow[];
    signed_count: number;
    total_count: number;
    cleared: boolean;
}

export interface ClearanceFilingCandidate {
    user_id: number;
    full_name: string;
    is_department_head: boolean;
}

export interface SignClearanceItemInput {
    signatureStrokes: string;
    signedByUserId: number;
    substitutionReason?: string | null;
    remarks?: string | null;
}

export interface ClearancePrintableItem {
    id: number;
    sort_order: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    status: string;
    expected_signer_user_id: number | null;
    expected_signer_name: string | null;
    signed_by_user_id: number | null;
    signer_name: string | null;
    signed_at: string | null;
    signature_strokes: string | null;
    substitution_reason: string | null;
    remarks: string | null;
}

export interface ClearancePrintable {
    id: number;
    resignation_id: number;
    user_id: number;
    employee_name: string;
    template_title_snapshot: string | null;
    status: string;
    created_at: string | null;
    confirmed_at: string | null;
    items: ClearancePrintableItem[];
}

const CLEARANCE_FILING_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_department,isDeleted";

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

function toDepartmentId(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    if (isRecord(value) && "department_id" in value) return toDepartmentId(value.department_id);
    return null;
}

function toSignerType(value: unknown): ClearanceSignerType | null {
    if (typeof value !== "string") return null;
    return (CLEARANCE_SIGNER_TYPES as readonly string[]).includes(value) ? (value as ClearanceSignerType) : null;
}

function isDeletedUser(row: Record<string, unknown>): boolean {
    const candidates = [row.isDeleted, row.is_deleted, row.deleted];
    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) continue;
        if (typeof candidate === "string") {
            const normalized = candidate.toLowerCase();
            if (normalized === "1" || normalized === "true") return true;
        } else if (Boolean(candidate)) {
            return true;
        }
    }
    return false;
}

function toFullName(row: Record<string, unknown>, fallbackId: number): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? `User ${fallbackId}` : name;
}

function normalizeRequestRow(raw: unknown): ClearanceFilingRequestRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const resignationId = toId(raw.resignation_id);
    const userId = toId(raw.user_id);
    const templateId = toId(raw.template_id);
    if (id === null || resignationId === null || userId === null || templateId === null) return null;
    return {
        id,
        resignation_id: resignationId,
        user_id: userId,
        template_id: templateId,
        template_code_snapshot: toNullableText(raw.template_code_snapshot),
        template_title_snapshot: toNullableText(raw.template_title_snapshot),
        status: typeof raw.status === "string" ? raw.status : "pending",
        confirmed_by: toNullableId(raw.confirmed_by),
        confirmed_at: toNullableText(raw.confirmed_at),
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
        updated_at: toNullableText(raw.updated_at),
        updated_by: toNullableId(raw.updated_by),
    };
}

function normalizeItemRow(raw: unknown): ClearanceFilingItemRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const categoryId = toId(raw.category_id);
    const label = toNullableText(raw.label_snapshot);
    const signerType = toSignerType(raw.signer_type_snapshot);
    if (id === null || requestId === null || categoryId === null || label === null || signerType === null) return null;
    return {
        id,
        request_id: requestId,
        category_id: categoryId,
        label_snapshot: label,
        instructions_snapshot: toNullableText(raw.instructions_snapshot),
        signer_type_snapshot: signerType,
        department_id_snapshot: toNullableId(raw.department_id_snapshot),
        department_name_snapshot: toNullableText(raw.department_name_snapshot),
        sort_order: toId(raw.sort_order) ?? 0,
        status: typeof raw.status === "string" ? raw.status : "pending",
        expected_signer_user_id: toNullableId(raw.expected_signer_user_id),
        signed_by_user_id: toNullableId(raw.signed_by_user_id),
        captured_by_user_id: toNullableId(raw.captured_by_user_id),
        substitution_reason: toNullableText(raw.substitution_reason),
        signature_strokes: toNullableText(raw.signature_strokes),
        remarks: toNullableText(raw.remarks),
        signed_at: toNullableText(raw.signed_at),
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
        updated_at: toNullableText(raw.updated_at),
        updated_by: toNullableId(raw.updated_by),
    };
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readListRaw(path: string, label: string): Promise<Record<string, unknown>[]> {
    const body: unknown = await dFetch(path);
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_FILING_ERROR_CODES.readFailed, `${label} read failed (${JSON.stringify(body).slice(0, 300)})`);
    }
    const rows: Record<string, unknown>[] = [];
    for (const entry of data) {
        if (isRecord(entry)) rows.push(entry);
    }
    return rows;
}

async function readRequestRow(id: number): Promise<ClearanceFilingRequestRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_request/${id}`);
    if (!raw) return null;
    return normalizeRequestRow(raw);
}

async function readItemRow(id: number): Promise<ClearanceFilingItemRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_item/${id}`);
    if (!raw) return null;
    return normalizeItemRow(raw);
}

async function listItemRows(requestId: number): Promise<ClearanceFilingItemRow[]> {
    const raws = await readListRaw(
        `/items/clearance_item?filter[request_id][_eq]=${requestId}&sort=sort_order,id&limit=-1`,
        "clearance_item"
    );
    const rows: ClearanceFilingItemRow[] = [];
    for (const raw of raws) {
        const row = normalizeItemRow(raw);
        if (!row) {
            fail(CLEARANCE_FILING_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push(row);
    }
    return rows;
}

async function listItemSignatoryRows(itemId: number): Promise<{ id: number; user_id: number }[]> {
    const raws = await readListRaw(
        `/items/clearance_item_signatory?filter[item_id][_eq]=${itemId}&sort=sort_order,id&limit=-1&fields=id,item_id,user_id,sort_order`,
        "clearance_item_signatory"
    );
    const rows: { id: number; user_id: number }[] = [];
    for (const raw of raws) {
        const rowId = toId(raw.id);
        const userId = toId(raw.user_id);
        if (rowId === null || userId === null) {
            fail(CLEARANCE_FILING_ERROR_CODES.readFailed, "clearance_item_signatory row contract mismatch");
        }
        rows.push({ id: rowId, user_id: userId });
    }
    return rows;
}

async function patchItemRow(id: number, patch: Record<string, unknown>): Promise<ClearanceFilingItemRow> {
    const body: unknown = await dFetch(`/items/clearance_item/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    const row = isRecord(data) ? normalizeItemRow(data) : null;
    if (!row) {
        fail(CLEARANCE_FILING_ERROR_CODES.writeFailed, `clearance_item/${id} update failed`);
    }
    return row;
}

async function patchRequestRow(id: number, patch: Record<string, unknown>): Promise<ClearanceFilingRequestRow> {
    const body: unknown = await dFetch(`/items/clearance_request/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    const row = isRecord(data) ? normalizeRequestRow(data) : null;
    if (!row) {
        fail(CLEARANCE_FILING_ERROR_CODES.writeFailed, `clearance_request/${id} update failed`);
    }
    return row;
}

async function appendEvent(input: {
    request_id: number;
    item_id: number | null;
    event_type: string;
    actor_id: number | null;
    reason: string | null;
    payload: Record<string, unknown> | null;
}): Promise<void> {
    await dFetch("/items/clearance_event", {
        method: "POST",
        body: JSON.stringify({
            request_id: input.request_id,
            item_id: input.item_id,
            event_type: input.event_type,
            actor_id: input.actor_id,
            reason: input.reason,
            payload: input.payload,
            created_at: nowUTC(),
        }),
    });
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${CLEARANCE_FILING_USER_FIELDS}`);
}

async function listUserRecordsByDepartment(departmentId: number): Promise<Record<string, unknown>[]> {
    return readListRaw(
        `/items/user?filter[user_department][_eq]=${departmentId}&fields=${CLEARANCE_FILING_USER_FIELDS}&limit=-1`,
        "user"
    );
}

async function listAllUserRecords(): Promise<Record<string, unknown>[]> {
    return readListRaw(`/items/user?fields=${CLEARANCE_FILING_USER_FIELDS}&limit=-1`, "user");
}

async function readDepartmentHeadId(departmentId: number): Promise<number | null> {
    const row = await readSingleOrNull(`/items/department/${departmentId}?fields=department_id,department_head_id`);
    if (!row) return null;
    return toNullableId(row.department_head_id);
}

function toDetail(request: ClearanceFilingRequestRow, items: ClearanceFilingItemRow[]): ClearanceFilingRequestDetail {
    const signed = items.filter((item) => item.status === "signed").length;
    return {
        ...request,
        items,
        signed_count: signed,
        total_count: items.length,
        cleared: request.status === "completed",
    };
}

export async function readFilingItemRequest(itemId: number): Promise<ClearanceFilingRequestRow | null> {
    const item = await readItemRow(itemId);
    if (!item) return null;
    return readRequestRow(item.request_id);
}

export async function getFilingRequestDetail(id: number): Promise<ClearanceFilingRequestDetail> {
    const request = await readRequestRow(id);
    if (!request) {
        fail(CLEARANCE_FILING_ERROR_CODES.requestNotFound, `clearance_request ${id} does not exist`);
    }
    return toDetail(request, await listItemRows(id));
}

export async function resolveFilingCandidateSet(itemId: number): Promise<ClearanceFilingCandidate[]> {
    const item = await readItemRow(itemId);
    if (!item) {
        fail(CLEARANCE_FILING_ERROR_CODES.itemNotFound, `clearance_item ${itemId} does not exist`);
    }
    const request = await readRequestRow(item.request_id);
    if (!request) {
        fail(CLEARANCE_FILING_ERROR_CODES.requestNotFound, `clearance_request ${item.request_id} does not exist`);
    }
    const subjectId = request.user_id;
    let records: Record<string, unknown>[] = [];
    if (item.signer_type_snapshot === "pool") {
        const signatoryRows = await listItemSignatoryRows(itemId);
        const rows = await Promise.all(signatoryRows.map((row) => readUserRecord(row.user_id)));
        for (const row of rows) {
            if (row) records.push(row);
        }
    } else if (item.signer_type_snapshot === "subject_department") {
        const subject = await readUserRecord(subjectId);
        const departmentId = subject ? toDepartmentId(subject.user_department) : null;
        records = departmentId === null ? [] : await listUserRecordsByDepartment(departmentId);
    } else if (item.signer_type_snapshot === "named_department") {
        records =
            item.department_id_snapshot === null
                ? []
                : await listUserRecordsByDepartment(item.department_id_snapshot);
    } else {
        records = await listAllUserRecords();
    }
    const departmentIds = [
        ...new Set(
            records.map((record) => toDepartmentId(record.user_department)).filter((id): id is number => id !== null)
        ),
    ];
    const headEntries = await Promise.all(
        departmentIds.map(async (departmentId) => ({ departmentId, headId: await readDepartmentHeadId(departmentId) }))
    );
    const headByDepartment = new Map<number, number | null>();
    for (const entry of headEntries) headByDepartment.set(entry.departmentId, entry.headId);
    const candidates: ClearanceFilingCandidate[] = [];
    for (const record of records) {
        const userId = toId(record.user_id);
        if (userId === null || userId === subjectId) continue;
        if (isDeletedUser(record)) continue;
        const departmentId = toDepartmentId(record.user_department);
        const headId = departmentId === null ? null : (headByDepartment.get(departmentId) ?? null);
        candidates.push({
            user_id: userId,
            full_name: toFullName(record, userId),
            is_department_head: headId !== null && headId === userId,
        });
    }
    candidates.sort((left, right) => left.full_name.localeCompare(right.full_name) || left.user_id - right.user_id);
    return candidates;
}

export async function pickClearanceSigner(
    itemId: number,
    userId: number,
    actorId: number | null
): Promise<ClearanceFilingItemRow> {
    const item = await readItemRow(itemId);
    if (!item) {
        fail(CLEARANCE_FILING_ERROR_CODES.itemNotFound, `clearance_item ${itemId} does not exist`);
    }
    const request = await readRequestRow(item.request_id);
    if (!request) {
        fail(CLEARANCE_FILING_ERROR_CODES.requestNotFound, `clearance_request ${item.request_id} does not exist`);
    }
    if (request.status === "completed") {
        fail(CLEARANCE_FILING_ERROR_CODES.requestCompleted, `clearance_request ${request.id} is completed`);
    }
    if (item.status === "signed") {
        fail(CLEARANCE_FILING_ERROR_CODES.itemSigned, `clearance_item ${itemId} is signed`);
    }
    if (userId === request.user_id) {
        fail(CLEARANCE_FILING_ERROR_CODES.subjectSelfSign, `clearance_item ${itemId} cannot be signed by the subject`);
    }
    const candidates = await resolveFilingCandidateSet(itemId);
    if (!candidates.some((candidate) => candidate.user_id === userId)) {
        fail(CLEARANCE_FILING_ERROR_CODES.notInCandidateSet, `user ${userId} is not in the candidate set`);
    }
    const now = nowUTC();
    const updated = await patchItemRow(itemId, {
        expected_signer_user_id: userId,
        updated_at: now,
        updated_by: actorId,
    });
    await appendEvent({
        request_id: item.request_id,
        item_id: itemId,
        event_type: "picked",
        actor_id: actorId,
        reason: null,
        payload: { expected_signer_user_id: userId },
    });
    return updated;
}

export async function signClearanceItem(
    itemId: number,
    input: SignClearanceItemInput,
    actorId: number | null
): Promise<ClearanceFilingItemRow> {
    if (input.signatureStrokes.trim() === "") {
        fail(CLEARANCE_FILING_ERROR_CODES.invalidInput, "signature_strokes is required");
    }
    const item = await readItemRow(itemId);
    if (!item) {
        fail(CLEARANCE_FILING_ERROR_CODES.itemNotFound, `clearance_item ${itemId} does not exist`);
    }
    const request = await readRequestRow(item.request_id);
    if (!request) {
        fail(CLEARANCE_FILING_ERROR_CODES.requestNotFound, `clearance_request ${item.request_id} does not exist`);
    }
    if (request.status === "completed") {
        fail(CLEARANCE_FILING_ERROR_CODES.requestCompleted, `clearance_request ${request.id} is completed`);
    }
    if (item.status === "signed") {
        fail(CLEARANCE_FILING_ERROR_CODES.itemSigned, `clearance_item ${itemId} is signed`);
    }
    if (item.expected_signer_user_id === null) {
        fail(CLEARANCE_FILING_ERROR_CODES.noPick, `clearance_item ${itemId} has no picked signer`);
    }
    if (input.signedByUserId === request.user_id) {
        fail(
            CLEARANCE_FILING_ERROR_CODES.subjectSelfSign,
            `clearance_item ${itemId} cannot be signed by the subject`
        );
    }
    const reason = input.substitutionReason === undefined ? null : input.substitutionReason;
    if (input.signedByUserId !== item.expected_signer_user_id && (reason === null || reason.trim() === "")) {
        fail(
            CLEARANCE_FILING_ERROR_CODES.substitutionReasonRequired,
            `clearance_item ${itemId} substitution requires a reason`
        );
    }
    const now = nowUTC();
    const updated = await patchItemRow(itemId, {
        signed_by_user_id: input.signedByUserId,
        captured_by_user_id: request.user_id,
        substitution_reason: reason === null || reason.trim() === "" ? null : reason,
        signature_strokes: input.signatureStrokes,
        remarks: input.remarks === undefined || input.remarks === null ? null : input.remarks,
        signed_at: now,
        status: "signed",
        updated_at: now,
        updated_by: actorId,
    });
    if (request.status === "pending") {
        await patchRequestRow(request.id, {
            status: "in_progress",
            updated_at: now,
            updated_by: actorId,
        });
    }
    await appendEvent({
        request_id: item.request_id,
        item_id: itemId,
        event_type: "signed",
        actor_id: actorId,
        reason: null,
        payload: {
            signed_by_user_id: input.signedByUserId,
            captured_by_user_id: request.user_id,
        },
    });
    return updated;
}

export async function getPrintableClearance(id: number): Promise<ClearancePrintable> {
    const request = await readRequestRow(id);
    if (!request) {
        fail(CLEARANCE_FILING_ERROR_CODES.requestNotFound, `clearance_request ${id} does not exist`);
    }
    const items = await listItemRows(id);
    const subject = await readUserRecord(request.user_id);
    const employeeName = subject ? toFullName(subject, request.user_id) : `User ${request.user_id}`;
    const signerIds = [
        ...new Set(
            items
                .flatMap((item) => [item.expected_signer_user_id, item.signed_by_user_id])
                .filter((entry): entry is number => entry !== null)
        ),
    ];
    const signerEntries = await Promise.all(
        signerIds.map(async (signerId) => ({ signerId, row: await readUserRecord(signerId) }))
    );
    const namesByUser = new Map<number, string>();
    for (const entry of signerEntries) {
        namesByUser.set(entry.signerId, entry.row ? toFullName(entry.row, entry.signerId) : `User ${entry.signerId}`);
    }
    return {
        id: request.id,
        resignation_id: request.resignation_id,
        user_id: request.user_id,
        employee_name: employeeName,
        template_title_snapshot: request.template_title_snapshot,
        status: request.status,
        created_at: request.created_at,
        confirmed_at: request.confirmed_at,
        items: items.map((item) => ({
            id: item.id,
            sort_order: item.sort_order,
            label_snapshot: item.label_snapshot,
            instructions_snapshot: item.instructions_snapshot,
            status: item.status,
            expected_signer_user_id: item.expected_signer_user_id,
            expected_signer_name:
                item.expected_signer_user_id === null
                    ? null
                    : (namesByUser.get(item.expected_signer_user_id) ?? `User ${item.expected_signer_user_id}`),
            signed_by_user_id: item.signed_by_user_id,
            signer_name:
                item.signed_by_user_id === null
                    ? null
                    : (namesByUser.get(item.signed_by_user_id) ?? `User ${item.signed_by_user_id}`),
            signed_at: item.signed_at,
            signature_strokes: item.signature_strokes,
            substitution_reason: item.substitution_reason,
            remarks: item.remarks,
        })),
    };
}

export function mapClearanceFilingError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_FILING_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_FILING_ERROR_CODES.itemNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance item not found" },
                { status: 404 }
            );
        case CLEARANCE_FILING_ERROR_CODES.invalidInput:
        case CLEARANCE_FILING_ERROR_CODES.notInCandidateSet:
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_FILING_ERROR_CODES.requestCompleted:
            return NextResponse.json(
                { success: false, code, message: "The clearance request is completed" },
                { status: 409 }
            );
        case CLEARANCE_FILING_ERROR_CODES.itemSigned:
            return NextResponse.json(
                { success: false, code, message: "The clearance item is signed" },
                { status: 409 }
            );
        case CLEARANCE_FILING_ERROR_CODES.subjectSelfSign:
            return NextResponse.json(
                { success: false, code, message: "The subject cannot sign their own clearance" },
                { status: 422 }
            );
        case CLEARANCE_FILING_ERROR_CODES.noPick:
            return NextResponse.json(
                { success: false, code, message: "No signer has been picked for this item" },
                { status: 422 }
            );
        case CLEARANCE_FILING_ERROR_CODES.substitutionReasonRequired:
            return NextResponse.json(
                { success: false, code, message: "A substitution reason is required" },
                { status: 422 }
            );
        default:
            return null;
    }
}
