import { NextResponse } from "next/server";

import { dFetch } from "../../utils/directus";
import { nowUTC } from "../../utils/audit";

export const CLEARANCE_TURNOVER_FILING_ERROR_CODES = {
    invalidInput: "CLEARANCE_TURNOVER_FILING_INVALID_INPUT",
    turnoverNotFound: "CLEARANCE_TURNOVER_NOT_FOUND",
    notAttached: "CLEARANCE_TURNOVER_PDF_NOT_ATTACHED",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    writeFailed: "CLEARANCE_TURNOVER_FILING_WRITE_FAILED",
    readFailed: "CLEARANCE_TURNOVER_FILING_READ_FAILED",
} as const;

export const CLEARANCE_DOCS_TYPE_NAME = "Employment & Contractual Documents";
export const CLEARANCE_DOCS_LIST_NAME = "Clearance & Quit Claims";

const CLEARANCE_DOCS_TYPE_DESCRIPTION =
    "Employment and contractual documents auto-filed on clearance approval — clearance forms, statements of account, and quit claims.";
const CLEARANCE_DOCS_LIST_DESCRIPTION =
    "Approved clearance documents auto-filed on approval — one record per approved document.";

export interface FileClearanceTurnoverPdfResult {
    recordId: number;
    fileRef: string;
    listId: number;
    alreadyFiled: boolean;
}

interface TurnoverRef {
    id: number;
    request_id: number;
    status: string;
    ref_no: string | null;
    pdf_file: string | null;
}

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

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readFirstOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body) || !Array.isArray(body.data) || body.data.length === 0) {
        return null;
    }
    const first: unknown = body.data[0];
    return isRecord(first) ? first : null;
}

async function deleteDirectusFileBestEffort(fileId: string): Promise<void> {
    try {
        if (fileId.trim() === "") return;
        await dFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    } catch {
        return;
    }
}

async function readTurnoverRef(id: number): Promise<TurnoverRef | null> {
    const row = await readSingleOrNull(
        `/items/clearance_turnover/${id}?fields=id,request_id,status,ref_no,pdf_file`
    );
    if (!row) return null;
    const rowId = toId(row.id);
    const requestId = toId(row.request_id);
    const status = toNullableText(row.status);
    if (rowId === null || requestId === null || status === null) return null;
    return {
        id: rowId,
        request_id: requestId,
        status,
        ref_no: toNullableText(row.ref_no),
        pdf_file: toNullableText(row.pdf_file),
    };
}

async function readRequestUserId(requestId: number): Promise<number | null> {
    const row = await readSingleOrNull(`/items/clearance_request/${requestId}?fields=id,user_id`);
    if (!row) return null;
    return toId(row.user_id);
}

async function readUserExists(userId: number): Promise<boolean> {
    const row = await readSingleOrNull(`/items/user/${userId}?fields=user_id`);
    return row !== null && toId(row.user_id) !== null;
}

let listInFlight: Promise<number> | null = null;

async function doEnsureClearanceDocsListId(): Promise<number> {
    const now = nowUTC();
    const typeRow = await readFirstOrNull(
        `/items/employee_file_record_type?filter[name][_eq]=${encodeURIComponent(CLEARANCE_DOCS_TYPE_NAME)}&fields=id&limit=1`
    );
    let typeId = typeRow ? toId(typeRow.id) : null;
    if (typeId === null) {
        const created: unknown = await dFetch("/items/employee_file_record_type", {
            method: "POST",
            body: JSON.stringify({
                name: CLEARANCE_DOCS_TYPE_NAME,
                description: CLEARANCE_DOCS_TYPE_DESCRIPTION,
                created_at: now,
                updated_at: now,
            }),
        });
        if (!isRecord(created) || hasErrors(created)) {
            fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_record_type create failed");
        }
        typeId = isRecord(created.data) ? toId(created.data.id) : null;
        if (typeId === null) {
            fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_record_type create returned no row");
        }
    }
    const listRow = await readFirstOrNull(
        `/items/employee_file_record_list?filter[record_type_id][_eq]=${typeId}` +
        `&filter[name][_eq]=${encodeURIComponent(CLEARANCE_DOCS_LIST_NAME)}&fields=id&limit=1`
    );
    if (listRow) {
        const listId = toId(listRow.id);
        if (listId !== null) return listId;
    }
    const created: unknown = await dFetch("/items/employee_file_record_list", {
        method: "POST",
        body: JSON.stringify({
            record_type_id: typeId,
            name: CLEARANCE_DOCS_LIST_NAME,
            description: CLEARANCE_DOCS_LIST_DESCRIPTION,
            created_at: now,
            updated_at: now,
        }),
    });
    if (!isRecord(created) || hasErrors(created)) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_record_list create failed");
    }
    const listId = isRecord(created.data) ? toId(created.data.id) : null;
    if (listId === null) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_record_list create returned no row");
    }
    return listId;
}

export function ensureClearanceDocsListId(): Promise<number> {
    if (listInFlight === null) {
        listInFlight = doEnsureClearanceDocsListId().finally(() => {
            listInFlight = null;
        });
    }
    return listInFlight;
}

export async function fileClearanceTurnoverPdf(id: number): Promise<FileClearanceTurnoverPdfResult> {
    if (!Number.isInteger(id) || id <= 0) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.invalidInput, "id is required");
    }
    const turnover = await readTurnoverRef(id);
    if (!turnover) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.turnoverNotFound, `clearance_turnover ${id} does not exist`);
    }
    if (!turnover.pdf_file) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.notAttached, `clearance_turnover ${id} has no attached PDF`);
    }
    const userId = await readRequestUserId(turnover.request_id);
    if (userId === null || !(await readUserExists(userId))) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.userNotFound, `user for clearance_turnover ${id} does not exist`);
    }
    const listId = await ensureClearanceDocsListId();
    const now = nowUTC();
    const recordName = turnover.ref_no
        ? `Turnover Checklist — ${turnover.ref_no}`
        : `Turnover Checklist — #${turnover.id}`;
    const filed = await readFirstOrNull(
        `/items/employee_file_records?filter[user_id][_eq]=${userId}` +
        `&filter[list_id][_eq]=${listId}` +
        `&filter[record_name][_eq]=${encodeURIComponent(recordName)}&fields=id,list_id,record_name,file_ref&limit=1`
    );
    if (filed) {
        const recordId = toId(filed.id);
        const filedListId = toId(filed.list_id);
        if (recordId !== null && filedListId !== null) {
            const previousFileRef = toNullableText(filed.file_ref);
            const patched: unknown = await dFetch(`/items/employee_file_records/${recordId}`, {
                method: "PATCH",
                body: JSON.stringify({ file_ref: turnover.pdf_file, updated_at: now }),
            });
            if (!isRecord(patched) || hasErrors(patched)) {
                fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_records update failed");
            }
            if (previousFileRef !== null && previousFileRef !== "" && previousFileRef !== turnover.pdf_file) {
                await deleteDirectusFileBestEffort(previousFileRef);
            }
            return { recordId, fileRef: turnover.pdf_file, listId: filedListId, alreadyFiled: true };
        }
    }
    const description = turnover.status === "approved"
        ? `Approved turnover checklist filed on approval (clearance_turnover #${turnover.id}${turnover.ref_no ? `, REF ${turnover.ref_no}` : ""}).`
        : `Turnover checklist uploaded to the 201 file before approval (clearance_turnover #${turnover.id}${turnover.ref_no ? `, REF ${turnover.ref_no}` : ""}).`;
    const created: unknown = await dFetch("/items/employee_file_records", {
        method: "POST",
        body: JSON.stringify({
            user_id: userId,
            list_id: listId,
            record_name: recordName,
            description,
            file_ref: turnover.pdf_file,
            is_deleted: 0,
            created_at: now,
            updated_at: now,
        }),
    });
    if (!isRecord(created) || hasErrors(created)) {
        fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_records create failed");
    }
    const recordId = isRecord(created.data) ? toId(created.data.id) : null;
    if (recordId !== null) {
        return { recordId, fileRef: turnover.pdf_file, listId, alreadyFiled: false };
    }
    const raced = await readFirstOrNull(
        `/items/employee_file_records?filter[user_id][_eq]=${userId}` +
        `&filter[list_id][_eq]=${listId}` +
        `&filter[record_name][_eq]=${encodeURIComponent(recordName)}&fields=id,list_id,file_ref&limit=1`
    );
    const racedId = raced ? toId(raced.id) : null;
    const racedList = raced ? toId(raced.list_id) : null;
    if (racedId !== null && racedList !== null) {
        const racedRef = raced ? toNullableText(raced.file_ref) : null;
        return { recordId: racedId, fileRef: racedRef ?? turnover.pdf_file, listId: racedList, alreadyFiled: true };
    }
    fail(CLEARANCE_TURNOVER_FILING_ERROR_CODES.writeFailed, "employee_file_records create returned no row");
}

export function mapClearanceTurnoverFilingError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_TURNOVER_FILING_ERROR_CODES.turnoverNotFound:
            return NextResponse.json(
                { success: false, code, message: "Turnover checklist not found" },
                { status: 404 }
            );
        case CLEARANCE_TURNOVER_FILING_ERROR_CODES.invalidInput:
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_TURNOVER_FILING_ERROR_CODES.notAttached:
        case CLEARANCE_TURNOVER_FILING_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "The turnover checklist cannot be filed" },
                { status: 409 }
            );
        default:
            return null;
    }
}
