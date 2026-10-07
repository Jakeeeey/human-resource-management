import { NextResponse } from "next/server";

import { dFetch } from "../../utils/directus";
import { nowUTC } from "../../utils/audit";

export const CLEARANCE_QUITCLAIM_FILING_ERROR_CODES = {
    invalidInput: "CLEARANCE_QUITCLAIM_FILING_INVALID_INPUT",
    quitclaimNotFound: "CLEARANCE_QUITCLAIM_NOT_FOUND",
    notApproved: "CLEARANCE_QUITCLAIM_NOT_APPROVED",
    notAttached: "CLEARANCE_QUITCLAIM_PDF_NOT_ATTACHED",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    writeFailed: "CLEARANCE_QUITCLAIM_FILING_WRITE_FAILED",
    readFailed: "CLEARANCE_QUITCLAIM_FILING_READ_FAILED",
} as const;

export const CLEARANCE_DOCS_TYPE_NAME = "Employment & Contractual Documents";
export const CLEARANCE_DOCS_LIST_NAME = "Clearance & Quit Claims";

const CLEARANCE_DOCS_TYPE_DESCRIPTION =
    "Employment and contractual documents auto-filed on clearance approval — clearance forms, statements of account, and quit claims.";
const CLEARANCE_DOCS_LIST_DESCRIPTION =
    "Approved clearance documents auto-filed on approval — one record per approved document.";

export interface FileClearanceQuitClaimPdfResult {
    recordId: number;
    fileRef: string;
    listId: number;
    alreadyFiled: boolean;
}

interface QuitClaimRef {
    id: number;
    user_id: number;
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

async function readQuitClaimRef(id: number): Promise<QuitClaimRef | null> {
    const row = await readSingleOrNull(
        `/items/clearance_quitclaim/${id}?fields=id,user_id,status,ref_no,pdf_file`
    );
    if (!row) return null;
    const rowId = toId(row.id);
    const userId = toId(row.user_id);
    const status = toNullableText(row.status);
    if (rowId === null || userId === null || status === null) return null;
    return {
        id: rowId,
        user_id: userId,
        status,
        ref_no: toNullableText(row.ref_no),
        pdf_file: toNullableText(row.pdf_file),
    };
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
            fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_record_type create failed");
        }
        typeId = isRecord(created.data) ? toId(created.data.id) : null;
        if (typeId === null) {
            fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_record_type create returned no row");
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
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_record_list create failed");
    }
    const listId = isRecord(created.data) ? toId(created.data.id) : null;
    if (listId === null) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_record_list create returned no row");
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

export async function fileClearanceQuitClaimPdf(
    id: number
): Promise<FileClearanceQuitClaimPdfResult> {
    if (!Number.isInteger(id) || id <= 0) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.invalidInput, "id is required");
    }
    const quitclaim = await readQuitClaimRef(id);
    if (!quitclaim) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.quitclaimNotFound, `clearance_quitclaim ${id} does not exist`);
    }
    if (quitclaim.status !== "approved") {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.notApproved, `clearance_quitclaim ${id} is not approved`);
    }
    if (!quitclaim.pdf_file) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.notAttached, `clearance_quitclaim ${id} has no attached PDF`);
    }
    if (!(await readUserExists(quitclaim.user_id))) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.userNotFound, `user ${quitclaim.user_id} does not exist`);
    }
    const listId = await ensureClearanceDocsListId();
    const now = nowUTC();
    const recordName = quitclaim.ref_no ? `Quit Claim — ${quitclaim.ref_no}` : `Quit Claim — #${quitclaim.id}`;
    const filed = await readFirstOrNull(
        `/items/employee_file_records?filter[user_id][_eq]=${quitclaim.user_id}` +
        `&filter[list_id][_eq]=${listId}` +
        `&filter[record_name][_eq]=${encodeURIComponent(recordName)}&fields=id,list_id,file_ref&limit=1`
    );
    if (filed) {
        const recordId = toId(filed.id);
        const filedListId = toId(filed.list_id);
        if (recordId !== null && filedListId !== null) {
            const storedRef = toNullableText(filed.file_ref);
            return { recordId, fileRef: storedRef ?? quitclaim.pdf_file, listId: filedListId, alreadyFiled: true };
        }
    }
    const created: unknown = await dFetch("/items/employee_file_records", {
        method: "POST",
        body: JSON.stringify({
            user_id: quitclaim.user_id,
            list_id: listId,
            record_name: recordName,
            description: `Approved quit claim filed on approval (clearance_quitclaim #${quitclaim.id}${quitclaim.ref_no ? `, REF ${quitclaim.ref_no}` : ""}).`,
            file_ref: quitclaim.pdf_file,
            is_deleted: 0,
            created_at: now,
            updated_at: now,
        }),
    });
    if (!isRecord(created) || hasErrors(created)) {
        fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_records create failed");
    }
    const recordId = isRecord(created.data) ? toId(created.data.id) : null;
    if (recordId !== null) {
        return { recordId, fileRef: quitclaim.pdf_file, listId, alreadyFiled: false };
    }
    const raced = await readFirstOrNull(
        `/items/employee_file_records?filter[user_id][_eq]=${quitclaim.user_id}` +
        `&filter[list_id][_eq]=${listId}` +
        `&filter[record_name][_eq]=${encodeURIComponent(recordName)}&fields=id,list_id,file_ref&limit=1`
    );
    const racedId = raced ? toId(raced.id) : null;
    const racedList = raced ? toId(raced.list_id) : null;
    if (racedId !== null && racedList !== null) {
        const racedRef = raced ? toNullableText(raced.file_ref) : null;
        return { recordId: racedId, fileRef: racedRef ?? quitclaim.pdf_file, listId: racedList, alreadyFiled: true };
    }
    fail(CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.writeFailed, "employee_file_records create returned no row");
}

export function mapClearanceQuitClaimFilingError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.quitclaimNotFound:
            return NextResponse.json(
                { success: false, code, message: "Quit claim not found" },
                { status: 404 }
            );
        case CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.invalidInput:
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.notApproved:
        case CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.notAttached:
        case CLEARANCE_QUITCLAIM_FILING_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "The quit claim cannot be filed" },
                { status: 409 }
            );
        default:
            return null;
    }
}
