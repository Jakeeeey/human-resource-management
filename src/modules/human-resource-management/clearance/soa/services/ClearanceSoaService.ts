import { NextResponse } from "next/server";

import {
    SOA_STATUSES,
    SoaLineInputSchema,
    SoaSignatoriesSchema,
    type SoaLineInput,
    type SoaSignatory,
    type SoaStatus,
} from "../types";
import type { SoaPrintInput, SoaPrintLine } from "../utils/soaPrintPdf";
import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";
import { allocateDocumentRef, type DocumentRefRow } from "./DocumentRefService";

export const CLEARANCE_SOA_ERROR_CODES = {
    invalidInput: "CLEARANCE_SOA_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    soaNotFound: "CLEARANCE_SOA_NOT_FOUND",
    soaIssued: "CLEARANCE_SOA_ISSUED",
    soaFrozen: "CLEARANCE_SOA_FROZEN",
    itemMismatch: "CLEARANCE_SOA_ITEM_MISMATCH",
    refAllocFailed: "DOCUMENT_REF_ALLOC_FAILED",
    writeFailed: "CLEARANCE_SOA_WRITE_FAILED",
    readFailed: "CLEARANCE_SOA_READ_FAILED",
} as const;

export interface ClearanceSoaRow {
    id: number;
    request_id: number;
    status: SoaStatus;
    ref_no: string | null;
    clearance_no: string | null;
    company_code: string | null;
    pdf_file: string | null;
    issued_at: string | null;
    issued_by: number | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceSoaLineRow {
    id: number;
    soa_id: number;
    item_id: number;
    description: string | null;
    amount: number | null;
    remarks: string | null;
    sort_order: number;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceSoaDetail extends ClearanceSoaRow {
    lines: ClearanceSoaLineRow[];
}

export interface ClearanceSoaListResult {
    data: ClearanceSoaRow[];
    total: number;
    page: number;
    limit: number;
}

export interface BuildSoaRenderModelCompany {
    company_name: string;
    company_address: string;
    logo_data_url: string | null;
}

export interface IssueSoaInput {
    requestId: number;
    actorId: number | null;
    companyCode: string;
}

export interface IssueSoaResult {
    soa: ClearanceSoaRow;
    ref: DocumentRefRow;
    clearanceNo: string;
}

interface RequestRef {
    id: number;
    resignation_id: number;
    user_id: number;
    template_id: number;
}

interface ItemRef {
    id: number;
    label_snapshot: string;
    sort_order: number;
}

const SOA_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_position,user_department,isDeleted";

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

function toNullableAmount(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function toSoaStatus(value: unknown): SoaStatus | null {
    if (typeof value !== "string") return null;
    return (SOA_STATUSES as readonly string[]).includes(value) ? (value as SoaStatus) : null;
}

function toFullName(row: Record<string, unknown>): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? "Unnamed team member" : name;
}

function normalizeSoaRow(raw: unknown): ClearanceSoaRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toSoaStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
        clearance_no: toNullableText(raw.clearance_no),
        company_code: toNullableText(raw.company_code),
        pdf_file: toNullableText(raw.pdf_file),
        issued_at: toNullableText(raw.issued_at),
        issued_by: toNullableId(raw.issued_by),
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
        updated_at: toNullableText(raw.updated_at),
        updated_by: toNullableId(raw.updated_by),
    };
}

function normalizeSoaLineRow(raw: unknown): ClearanceSoaLineRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const soaId = toId(raw.soa_id);
    const itemId = toId(raw.item_id);
    if (id === null || soaId === null || itemId === null) return null;
    return {
        id,
        soa_id: soaId,
        item_id: itemId,
        description: toNullableText(raw.description),
        amount: toNullableAmount(raw.amount),
        remarks: toNullableText(raw.remarks),
        sort_order: toId(raw.sort_order) ?? 0,
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

async function readRequestRef(id: number): Promise<RequestRef | null> {
    const row = await readSingleOrNull(
        `/items/clearance_request/${id}?fields=id,resignation_id,user_id,template_id`
    );
    if (!row) return null;
    const rowId = toId(row.id);
    const resignationId = toId(row.resignation_id);
    const userId = toId(row.user_id);
    const templateId = toId(row.template_id);
    if (rowId === null || resignationId === null || userId === null || templateId === null) return null;
    return { id: rowId, resignation_id: resignationId, user_id: userId, template_id: templateId };
}

async function listItemRefs(requestId: number): Promise<ItemRef[]> {
    const body: unknown = await dFetch(
        `/items/clearance_item?filter[request_id][_eq]=${requestId}` +
        `&sort=sort_order,id&limit=-1&fields=id,label_snapshot,sort_order`
    );
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_item read failed");
    }
    const rows: ItemRef[] = [];
    for (const entry of data) {
        if (!isRecord(entry)) continue;
        const id = toId(entry.id);
        const label = toNullableText(entry.label_snapshot);
        if (id === null || label === null) {
            fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push({ id, label_snapshot: label, sort_order: toId(entry.sort_order) ?? 0 });
    }
    return rows;
}

async function listSoaLineRows(soaId: number): Promise<ClearanceSoaLineRow[]> {
    const body: unknown = await dFetch(
        `/items/clearance_soa_line?filter[soa_id][_eq]=${soaId}&sort=sort_order,id&limit=-1`
    );
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_soa_line read failed");
    }
    const rows: ClearanceSoaLineRow[] = [];
    for (const entry of data) {
        const row = normalizeSoaLineRow(entry);
        if (!row) {
            fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_soa_line row contract mismatch");
        }
        rows.push(row);
    }
    return rows;
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${SOA_USER_FIELDS}`);
}

async function readResignationDate(resignationId: number): Promise<string> {
    const row = await readSingleOrNull(
        `/items/resignation_request/${resignationId}?fields=id,user_id,resignation_date`
    );
    if (!row) return "";
    return toNullableText(row.resignation_date) ?? "";
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

export async function readSoaSignatories(templateId: number): Promise<SoaSignatory[]> {
    const row = await readSingleOrNull(`/items/clearance_template/${templateId}?fields=id,soa_signatories`);
    if (!row) return [];
    const raw: unknown = row.soa_signatories;
    if (raw === null || raw === undefined) return [];
    let parsed: unknown = raw;
    if (typeof raw === "string") {
        if (raw.trim() === "") return [];
        try {
            parsed = JSON.parse(raw) as unknown;
        } catch {
            return [];
        }
    }
    const checked = SoaSignatoriesSchema.safeParse(parsed);
    return checked.success ? checked.data : [];
}

export async function getSoaByRequest(requestId: number): Promise<ClearanceSoaDetail | null> {
    const body: unknown = await dFetch(
        `/items/clearance_soa?filter[request_id][_eq]=${requestId}&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_soa read failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeSoaRow(entry);
        if (row) return { ...row, lines: await listSoaLineRows(row.id) };
    }
    return null;
}

async function readSoaRow(id: number): Promise<ClearanceSoaRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_soa/${id}`);
    if (!raw) return null;
    return normalizeSoaRow(raw);
}

export async function ensureSoa(requestId: number, actorId: number | null): Promise<ClearanceSoaDetail> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_SOA_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const existing = await getSoaByRequest(requestId);
    if (existing) return existing;
    const now = nowUTC();
    try {
        const body: unknown = await dFetch("/items/clearance_soa", {
            method: "POST",
            body: JSON.stringify({
                request_id: requestId,
                status: "draft",
                ref_no: null,
                clearance_no: null,
                company_code: null,
                pdf_file: null,
                issued_at: null,
                issued_by: null,
                created_at: now,
                created_by: actorId,
                updated_at: null,
                updated_by: null,
            }),
        });
        const row = isRecord(body) && !Array.isArray(body.data) ? normalizeSoaRow(body.data) : null;
        if (row) return { ...row, lines: [] };
    } catch {
        const raced = await getSoaByRequest(requestId);
        if (raced) return raced;
    }
    const raced = await getSoaByRequest(requestId);
    if (raced) return raced;
    fail(CLEARANCE_SOA_ERROR_CODES.writeFailed, "clearance_soa create failed");
}

export async function saveSoaLines(
    soaId: number,
    lines: SoaLineInput[],
    actorId: number | null
): Promise<ClearanceSoaLineRow[]> {
    if (!Number.isInteger(soaId) || soaId <= 0 || !Array.isArray(lines)) {
        fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, "soaId and lines are required");
    }
    const checked: SoaLineInput[] = [];
    for (const line of lines) {
        const parsed = SoaLineInputSchema.safeParse(line);
        if (!parsed.success) {
            fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, `soa line is invalid (${parsed.error.issues[0]?.message ?? "unknown"})`);
        }
        checked.push(parsed.data);
    }
    const soa = await readSoaRow(soaId);
    if (!soa) {
        fail(CLEARANCE_SOA_ERROR_CODES.soaNotFound, `clearance_soa ${soaId} does not exist`);
    }
    if (soa.status === "issued") {
        fail(CLEARANCE_SOA_ERROR_CODES.soaIssued, `clearance_soa ${soaId} is already issued`);
    }
    const items = await listItemRefs(soa.request_id);
    const itemIds = new Set(items.map((item) => item.id));
    for (const line of checked) {
        if (!itemIds.has(line.item_id)) {
            fail(CLEARANCE_SOA_ERROR_CODES.itemMismatch, `clearance_item ${line.item_id} is not on this request`);
        }
    }
    const existing = await listSoaLineRows(soaId);
    if (existing.length > 0) {
        await dFetch("/items/clearance_soa_line", {
            method: "DELETE",
            body: JSON.stringify(existing.map((row) => row.id)),
        });
    }
    const now = nowUTC();
    if (checked.length === 0) return [];
    const body: unknown = await dFetch("/items/clearance_soa_line", {
        method: "POST",
        body: JSON.stringify(
            checked.map((line, index) => ({
                soa_id: soaId,
                item_id: line.item_id,
                description: line.description === "" ? null : line.description,
                amount: line.amount,
                remarks: line.remarks === "" ? null : line.remarks,
                sort_order: line.sort_order ?? index,
                created_at: now,
                created_by: actorId,
                updated_at: null,
                updated_by: null,
            }))
        ),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.writeFailed, "clearance_soa_line batch create failed");
    }
    const rows: ClearanceSoaLineRow[] = [];
    for (const entry of data) {
        const row = normalizeSoaLineRow(entry);
        if (!row) {
            fail(CLEARANCE_SOA_ERROR_CODES.writeFailed, "clearance_soa_line row contract mismatch after create");
        }
        rows.push(row);
    }
    return rows;
}

export async function buildSoaRenderModel(
    requestId: number,
    company: BuildSoaRenderModelCompany,
    overrides?: { refNo?: string; clearanceNo?: string }
): Promise<SoaPrintInput> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_SOA_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const [userRow, items, header, signatories] = await Promise.all([
        readUserRecord(request.user_id),
        listItemRefs(requestId),
        getSoaByRequest(requestId),
        readSoaSignatories(request.template_id),
    ]);
    if (!userRow) {
        fail(CLEARANCE_SOA_ERROR_CODES.userNotFound, `user ${request.user_id} does not exist`);
    }
    const labels = new Map(items.map((item) => [item.id, item.label_snapshot]));
    const storedLines = header ? header.lines : [];
    const printLines: SoaPrintLine[] = storedLines.map((line) => ({
        department: labels.get(line.item_id) ?? "",
        description: line.description ?? "",
        amount: line.amount,
        remarks: line.remarks ?? "",
    }));
    const separation = await readResignationDate(request.resignation_id);
    const clearanceNo = overrides?.clearanceNo
        ?? header?.clearance_no
        ?? (await readClearanceRefNo(requestId));
    return {
        refNo: overrides?.refNo ?? header?.ref_no ?? "",
        clearanceNo,
        employeeName: toFullName(userRow),
        position: toNullableText(userRow.user_position) ?? "",
        dateOfSeparation: separation,
        companyName: company.company_name,
        companyAddress: company.company_address,
        logoDataUrl: company.logo_data_url,
        signatories,
        lines: printLines,
    };
}

export async function issueSoa(input: IssueSoaInput): Promise<IssueSoaResult> {
    const companyCode = input.companyCode.trim();
    if (!Number.isInteger(input.requestId) || input.requestId <= 0 || companyCode === "") {
        fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, "requestId and companyCode are required");
    }
    const header = await ensureSoa(input.requestId, input.actorId);
    if (header.status === "issued") {
        fail(CLEARANCE_SOA_ERROR_CODES.soaIssued, `clearance_soa ${header.id} is already issued`);
    }
    let ref: DocumentRefRow;
    try {
        ref = await allocateDocumentRef({ documentId: header.id, companyCode, actorId: input.actorId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("DOCUMENT_REF_ALLOC_FAILED")) {
            fail(CLEARANCE_SOA_ERROR_CODES.refAllocFailed, message);
        }
        throw error;
    }
    const clearanceNo = await readClearanceRefNo(input.requestId);
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_soa/${header.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            status: "issued",
            ref_no: ref.ref_no,
            clearance_no: clearanceNo === "" ? null : clearanceNo,
            company_code: companyCode,
            issued_at: now,
            issued_by: input.actorId,
            updated_at: now,
            updated_by: input.actorId,
        }),
    });
    const updated = isRecord(body) && !Array.isArray(body.data) ? normalizeSoaRow(body.data) : null;
    if (!updated) {
        fail(CLEARANCE_SOA_ERROR_CODES.writeFailed, `clearance_soa/${header.id} issue failed`);
    }
    return { soa: updated, ref, clearanceNo };
}

export async function attachSoaPdf(
    soaId: number,
    pdfFileId: string,
    actorId: number | null
): Promise<ClearanceSoaRow> {
    if (!Number.isInteger(soaId) || soaId <= 0 || pdfFileId.trim() === "") {
        fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, "soaId and pdfFileId are required");
    }
    const current = await readSoaRow(soaId);
    if (!current) {
        fail(CLEARANCE_SOA_ERROR_CODES.soaNotFound, `clearance_soa ${soaId} does not exist`);
    }
    if (current.status !== "issued") {
        fail(CLEARANCE_SOA_ERROR_CODES.soaNotFound, `clearance_soa ${soaId} is not issued`);
    }
    if (current.pdf_file !== null && current.pdf_file !== "") {
        fail(CLEARANCE_SOA_ERROR_CODES.soaFrozen, `clearance_soa ${soaId} pdf is frozen`);
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_soa/${soaId}`, {
        method: "PATCH",
        body: JSON.stringify({ pdf_file: pdfFileId, updated_at: now, updated_by: actorId }),
    });
    const updated = isRecord(body) && !Array.isArray(body.data) ? normalizeSoaRow(body.data) : null;
    if (!updated) {
        fail(CLEARANCE_SOA_ERROR_CODES.writeFailed, `clearance_soa/${soaId} pdf attach failed`);
    }
    return updated;
}

export async function listSoas(query: {
    page?: number;
    limit?: number;
    status?: SoaStatus;
}): Promise<ClearanceSoaListResult> {
    const page = query.page !== undefined && Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = query.limit !== undefined && Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : 25;
    if (query.status !== undefined && !toSoaStatus(query.status)) {
        fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, "status must be draft or issued");
    }
    const filters: string[] = [];
    if (query.status !== undefined) filters.push(`filter[status][_eq]=${query.status}`);
    filters.push("sort=-id", `limit=${limit}`, `offset=${(page - 1) * limit}`, "meta=total_count");
    const body: unknown = await dFetch(`/items/clearance_soa?${filters.join("&")}`);
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_soa list failed");
    }
    const rows: ClearanceSoaRow[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeSoaRow(entry);
        if (row) rows.push(row);
    }
    const meta: unknown = (body as { meta?: unknown }).meta;
    const total = isRecord(meta) && toId(meta.total_count) !== null
        ? (toId(meta.total_count) as number)
        : rows.length;
    return { data: rows, total, page, limit };
}

export interface ClearanceSoaOverviewRow {
    request_id: number;
    employee_name: string;
    template_code: string | null;
    template_title: string | null;
    request_status: string;
    status: SoaStatus | "missing";
    soa_id: number | null;
    ref_no: string | null;
    clearance_no: string | null;
    company_code: string | null;
    created_at: string | null;
}

export interface ClearanceSoaOverviewResult {
    data: ClearanceSoaOverviewRow[];
    total: number;
    page: number;
    limit: number;
}

export type ClearanceSoaOverviewStatusFilter = SoaStatus | "missing";

interface OverviewRequestRef {
    id: number;
    user_id: number;
    template_code: string | null;
    template_title: string | null;
    request_status: string;
    created_at: string | null;
}

const OVERVIEW_REQUEST_FIELDS = "id,user_id,template_code_snapshot,template_title_snapshot,status,created_at";

function toOverviewRequest(raw: unknown): OverviewRequestRef | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const userId = toId(raw.user_id);
    if (id === null || userId === null) return null;
    return {
        id,
        user_id: userId,
        template_code: toNullableText(raw.template_code_snapshot),
        template_title: toNullableText(raw.template_title_snapshot),
        request_status: typeof raw.status === "string" ? raw.status : "pending",
        created_at: toNullableText(raw.created_at),
    };
}

function toOverviewStatus(value: unknown): ClearanceSoaOverviewStatusFilter | null {
    if (value === "missing") return "missing";
    return toSoaStatus(value);
}

async function readOverviewRequestPage(page: number, limit: number): Promise<{ rows: OverviewRequestRef[]; total: number }> {
    const body: unknown = await dFetch(
        `/items/clearance_request?sort=-id&limit=${limit}&offset=${(page - 1) * limit}&meta=total_count&fields=${OVERVIEW_REQUEST_FIELDS}`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_request list failed");
    }
    const rows: OverviewRequestRef[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = toOverviewRequest(entry);
        if (row) rows.push(row);
    }
    const meta: unknown = (body as { meta?: unknown }).meta;
    const total = isRecord(meta) && toId(meta.total_count) !== null
        ? (toId(meta.total_count) as number)
        : rows.length;
    return { rows, total };
}

async function readAllOverviewRequests(): Promise<OverviewRequestRef[]> {
    const body: unknown = await dFetch(
        `/items/clearance_request?sort=-id&limit=-1&fields=${OVERVIEW_REQUEST_FIELDS}`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_request list failed");
    }
    const rows: OverviewRequestRef[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = toOverviewRequest(entry);
        if (row) rows.push(row);
    }
    return rows;
}

async function readSoasForRequests(requestIds: number[]): Promise<Map<number, ClearanceSoaRow>> {
    const byRequest = new Map<number, ClearanceSoaRow>();
    if (requestIds.length === 0) return byRequest;
    const body: unknown = await dFetch(
        `/items/clearance_soa?filter[request_id][_in]=${requestIds.join(",")}&limit=-1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_SOA_ERROR_CODES.readFailed, "clearance_soa list failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeSoaRow(entry);
        if (row && !byRequest.has(row.request_id)) byRequest.set(row.request_id, row);
    }
    return byRequest;
}

async function readOverviewUserNames(userIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    if (userIds.length === 0) return names;
    const body: unknown = await dFetch(
        `/items/user?filter[user_id][_in]=${userIds.join(",")}&limit=-1&fields=user_id,user_fname,user_mname,user_lname`
    );
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) return names;
    for (const entry of data) {
        if (!isRecord(entry)) continue;
        const id = toId(entry.user_id);
        if (id === null) continue;
        names.set(id, toFullName(entry));
    }
    return names;
}

function toOverviewRow(
    request: OverviewRequestRef,
    soa: ClearanceSoaRow | undefined,
    names: Map<number, string>
): ClearanceSoaOverviewRow {
    return {
        request_id: request.id,
        employee_name: names.get(request.user_id) ?? "Unknown employee",
        template_code: request.template_code,
        template_title: request.template_title,
        request_status: request.request_status,
        status: soa ? soa.status : "missing",
        soa_id: soa ? soa.id : null,
        ref_no: soa ? soa.ref_no : null,
        clearance_no: soa ? soa.clearance_no : null,
        company_code: soa ? soa.company_code : null,
        created_at: soa ? soa.created_at : request.created_at,
    };
}

export async function listSoaOverview(query: {
    page?: number;
    limit?: number;
    status?: ClearanceSoaOverviewStatusFilter;
}): Promise<ClearanceSoaOverviewResult> {
    const page = query.page !== undefined && Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = query.limit !== undefined && Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : 25;
    if (query.status !== undefined && !toOverviewStatus(query.status)) {
        fail(CLEARANCE_SOA_ERROR_CODES.invalidInput, "status must be missing, draft or issued");
    }
    if (query.status === undefined) {
        const { rows: requests, total } = await readOverviewRequestPage(page, limit);
        const soas = await readSoasForRequests(requests.map((request) => request.id));
        const names = await readOverviewUserNames([...new Set(requests.map((request) => request.user_id))]);
        return {
            data: requests.map((request) => toOverviewRow(request, soas.get(request.id), names)),
            total,
            page,
            limit,
        };
    }
    const requests = await readAllOverviewRequests();
    const soas = await readSoasForRequests(requests.map((request) => request.id));
    const joined = requests.map((request) => ({ request, soa: soas.get(request.id) }));
    const filtered = joined.filter(({ soa }) => (soa ? soa.status : "missing") === query.status);
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    const names = await readOverviewUserNames([...new Set(slice.map(({ request }) => request.user_id))]);
    return {
        data: slice.map(({ request, soa }) => toOverviewRow(request, soa, names)),
        total,
        page,
        limit,
    };
}

export function mapClearanceSoaError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_SOA_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_SOA_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "Employee not found" },
                { status: 404 }
            );
        case CLEARANCE_SOA_ERROR_CODES.soaNotFound:
            return NextResponse.json(
                { success: false, code, message: "Statement of account not found" },
                { status: 404 }
            );
        case CLEARANCE_SOA_ERROR_CODES.invalidInput:
        case CLEARANCE_SOA_ERROR_CODES.itemMismatch:
        case "DOCUMENT_REF_INVALID_INPUT":
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_SOA_ERROR_CODES.soaIssued:
        case CLEARANCE_SOA_ERROR_CODES.soaFrozen:
        case CLEARANCE_SOA_ERROR_CODES.refAllocFailed:
        case "DOCUMENT_REF_ALLOC_FAILED":
            return NextResponse.json({ success: false, code, message: "The statement of account cannot be issued" }, { status: 409 });
        default:
            return null;
    }
}
