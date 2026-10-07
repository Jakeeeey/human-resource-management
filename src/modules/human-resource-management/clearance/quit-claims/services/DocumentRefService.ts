import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";

export const QUITCLAIM_DOCUMENT_TYPE = "quitclaim";

export const DOCUMENT_REF_ERROR_CODES = {
    invalidInput: "DOCUMENT_REF_INVALID_INPUT",
    writeFailed: "DOCUMENT_REF_WRITE_FAILED",
    readFailed: "DOCUMENT_REF_READ_FAILED",
    allocFailed: "DOCUMENT_REF_ALLOC_FAILED",
} as const;

export interface DocumentRefRow {
    id: number;
    document_type: string;
    document_id: number;
    company_code: string;
    year: number;
    seq: number;
    ref_no: string;
    created_at: string | null;
    created_by: number | null;
}

export interface AllocateDocumentRefInput {
    documentId: number;
    companyCode: string;
    year?: number;
    actorId: number | null;
}

const MAX_ATTEMPTS = 3;

function fail(code: string, detail: string): never {
    throw new Error(`${code}: ${detail}`);
}

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

function toNullableId(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return toId(value);
}

function toNullableText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    return typeof value === "string" ? value : null;
}

function errorMessages(body: unknown): string[] {
    if (!isRecord(body)) return [];
    const errors: unknown = body.errors;
    if (!Array.isArray(errors)) return [];
    const messages: string[] = [];
    for (const entry of errors) {
        if (isRecord(entry) && typeof entry.message === "string") messages.push(entry.message);
    }
    return messages;
}

function isUniqueViolation(body: unknown): boolean {
    return errorMessages(body).some((message) => /unique|duplicate|already exists|constraint/i.test(message));
}

function mentionsTargetKey(body: unknown): boolean {
    return errorMessages(body).some((message) => message.includes("uq_doc_ref_target"));
}

function normalizeRefRow(raw: unknown): DocumentRefRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const documentId = toId(raw.document_id);
    const companyCode = toNullableText(raw.company_code);
    const year = toId(raw.year);
    const seq = toId(raw.seq);
    const refNo = toNullableText(raw.ref_no);
    const documentType = toNullableText(raw.document_type);
    if (id === null || documentId === null || companyCode === null || year === null || seq === null) return null;
    if (refNo === null || documentType === null) return null;
    return {
        id,
        document_type: documentType,
        document_id: documentId,
        company_code: companyCode,
        year,
        seq,
        ref_no: refNo,
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
    };
}

function toMaxSeq(body: unknown): number | null {
    if (!isRecord(body)) return null;
    const data: unknown = body.data;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first: unknown = data[0];
    if (!isRecord(first)) return null;
    const candidates: unknown[] = [
        (first.max as Record<string, unknown> | undefined)?.seq,
        first.max_seq,
        first.seq,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0) return candidate;
        if (typeof candidate === "string" && candidate.trim() !== "") {
            const parsed = Number(candidate);
            if (Number.isInteger(parsed) && parsed >= 0) return parsed;
        }
    }
    return null;
}

function formatRefNo(companyCode: string, year: number, seq: number): string {
    return `${companyCode}${year}-${String(seq).padStart(4, "0")}`;
}

export async function readDocumentRef(documentId: number): Promise<DocumentRefRow | null> {
    const body: unknown = await dFetch(
        `/items/clearance_document_ref?filter[document_type][_eq]=${QUITCLAIM_DOCUMENT_TYPE}` +
        `&filter[document_id][_eq]=${documentId}&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(DOCUMENT_REF_ERROR_CODES.readFailed, "clearance_document_ref read failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeRefRow(entry);
        if (row) return row;
    }
    return null;
}

async function readMaxSeq(companyCode: string, year: number): Promise<number> {
    const body: unknown = await dFetch(
        `/items/clearance_document_ref?aggregate[max]=seq` +
        `&filter[company_code][_eq]=${encodeURIComponent(companyCode)}&filter[year][_eq]=${year}`
    );
    return toMaxSeq(body) ?? 0;
}

export async function allocateDocumentRef(input: AllocateDocumentRefInput): Promise<DocumentRefRow> {
    const companyCode = input.companyCode.trim();
    const year = input.year ?? new Date().getFullYear();
    if (!Number.isInteger(input.documentId) || input.documentId <= 0 || companyCode === "") {
        fail(DOCUMENT_REF_ERROR_CODES.invalidInput, "documentId and companyCode are required");
    }
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        fail(DOCUMENT_REF_ERROR_CODES.invalidInput, "year is out of range");
    }
    const existing = await readDocumentRef(input.documentId);
    if (existing) return existing;
    let seq = (await readMaxSeq(companyCode, year)) + 1;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const refNo = formatRefNo(companyCode, year, seq);
        const body: unknown = await dFetch("/items/clearance_document_ref", {
            method: "POST",
            body: JSON.stringify({
                document_type: QUITCLAIM_DOCUMENT_TYPE,
                document_id: input.documentId,
                company_code: companyCode,
                year,
                seq,
                ref_no: refNo,
                created_at: nowUTC(),
                created_by: input.actorId,
            }),
        });
        const row = isRecord(body) && !Array.isArray(body.data) ? normalizeRefRow(body.data) : null;
        if (row) return row;
        if (!isUniqueViolation(body)) {
            fail(DOCUMENT_REF_ERROR_CODES.writeFailed, `clearance_document_ref create failed (${JSON.stringify(body).slice(0, 200)})`);
        }
        if (mentionsTargetKey(body)) {
            const raced = await readDocumentRef(input.documentId);
            if (raced) return raced;
        }
        seq = (await readMaxSeq(companyCode, year)) + 1;
    }
    fail(DOCUMENT_REF_ERROR_CODES.allocFailed, `ref allocation collided ${MAX_ATTEMPTS} times for ${companyCode}${year}`);
}
