import { NextResponse } from "next/server";

import {
    CLEARANCE_FORM_STATUSES,
    type ClearanceFormRenderModel,
    type ClearanceFormStatus,
} from "../types";
import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";
import { allocateDocumentRef, type DocumentRefRow } from "./DocumentRefService";

export const CLEARANCE_FORM_ERROR_CODES = {
    invalidInput: "CLEARANCE_FORM_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    formNotFound: "CLEARANCE_FORM_NOT_FOUND",
    formIssued: "CLEARANCE_FORM_ISSUED",
    formFrozen: "CLEARANCE_FORM_FROZEN",
    refAllocFailed: "DOCUMENT_REF_ALLOC_FAILED",
    writeFailed: "CLEARANCE_FORM_WRITE_FAILED",
    readFailed: "CLEARANCE_FORM_READ_FAILED",
} as const;

export interface ClearanceFormRow {
    id: number;
    request_id: number;
    status: ClearanceFormStatus;
    ref_no: string | null;
    company_code: string | null;
    pdf_file: string | null;
    issued_at: string | null;
    issued_by: number | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceFormListResult {
    data: ClearanceFormRow[];
    total: number;
    page: number;
    limit: number;
}

export interface IssueClearanceFormInput {
    requestId: number;
    actorId: number | null;
    companyCode: string;
    date?: string;
}

export interface IssueClearanceFormResult {
    form: ClearanceFormRow;
    ref: DocumentRefRow;
    renderModel: ClearanceFormRenderModel;
}

interface RequestRef {
    id: number;
    resignation_id: number;
    user_id: number;
}

interface ItemRef {
    id: number;
    label_snapshot: string;
    sort_order: number;
    signatory_id: number | null;
    remarks: string | null;
}

export interface ClearanceFormCompanyBlock {
    company_name: string;
    company_address?: string | null;
    logo_data_url?: string | null;
}

const FORM_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_position,user_department,isDeleted";

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

function toFormStatus(value: unknown): ClearanceFormStatus | null {
    if (typeof value !== "string") return null;
    return (CLEARANCE_FORM_STATUSES as readonly string[]).includes(value)
        ? (value as ClearanceFormStatus)
        : null;
}

function toFullName(row: Record<string, unknown>): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? "Unnamed team member" : name;
}

function normalizeFormRow(raw: unknown): ClearanceFormRow | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const status = toFormStatus(raw.status);
    if (id === null || requestId === null || status === null) return null;
    return {
        id,
        request_id: requestId,
        status,
        ref_no: toNullableText(raw.ref_no),
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

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
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
        `&sort=sort_order,id&limit=-1&fields=id,label_snapshot,sort_order,signatory_id,remarks`
    );
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_item read failed");
    }
    const rows: ItemRef[] = [];
    for (const entry of data) {
        if (!isRecord(entry)) continue;
        const id = toId(entry.id);
        const label = toNullableText(entry.label_snapshot);
        if (id === null || label === null) {
            fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push({
            id,
            label_snapshot: label,
            sort_order: toId(entry.sort_order) ?? 0,
            signatory_id: toNullableId(entry.signatory_id),
            remarks: toNullableText(entry.remarks),
        });
    }
    return rows;
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${FORM_USER_FIELDS}`);
}

async function readResignationDate(resignationId: number): Promise<string> {
    const row = await readSingleOrNull(
        `/items/resignation_request/${resignationId}?fields=id,user_id,resignation_date`
    );
    if (!row) return "";
    const date = toNullableText(row.resignation_date);
    return date ?? "";
}

export async function getClearanceFormByRequest(requestId: number): Promise<ClearanceFormRow | null> {
    const body: unknown = await dFetch(
        `/items/clearance_form?filter[request_id][_eq]=${requestId}&limit=1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_form read failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeFormRow(entry);
        if (row) return row;
    }
    return null;
}

async function readFormRow(id: number): Promise<ClearanceFormRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_form/${id}`);
    if (!raw) return null;
    return normalizeFormRow(raw);
}

export async function ensureClearanceForm(requestId: number, actorId: number | null): Promise<ClearanceFormRow> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_FORM_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const existing = await getClearanceFormByRequest(requestId);
    if (existing) return existing;
    const now = nowUTC();
    try {
        const body: unknown = await dFetch("/items/clearance_form", {
            method: "POST",
            body: JSON.stringify({
                request_id: requestId,
                status: "draft",
                ref_no: null,
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
        const row = isRecord(body) && !Array.isArray(body.data) ? normalizeFormRow(body.data) : null;
        if (row) return row;
    } catch {
        const raced = await getClearanceFormByRequest(requestId);
        if (raced) return raced;
    }
    const raced = await getClearanceFormByRequest(requestId);
    if (raced) return raced;
    fail(CLEARANCE_FORM_ERROR_CODES.writeFailed, "clearance_form create failed");
}

export async function buildClearanceFormRenderModel(
    requestId: number,
    overrides?: { date?: string; refNo?: string; company?: ClearanceFormCompanyBlock }
): Promise<ClearanceFormRenderModel> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_FORM_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const [userRow, items, form] = await Promise.all([
        readUserRecord(request.user_id),
        listItemRefs(requestId),
        getClearanceFormByRequest(requestId),
    ]);
    if (!userRow) {
        fail(CLEARANCE_FORM_ERROR_CODES.userNotFound, `user ${request.user_id} does not exist`);
    }
    const signerIds = [...new Set(
        items.map((item) => item.signatory_id).filter((id): id is number => id !== null)
    )];
    const signerEntries = await Promise.all(
        signerIds.map(async (userId) => ({ userId, row: await readUserRecord(userId) }))
    );
    const signerNames = new Map<number, string>();
    for (const entry of signerEntries) {
        if (entry.row) signerNames.set(entry.userId, toFullName(entry.row));
    }
    const position = toNullableText(userRow.user_position) ?? "";
    const company = overrides?.company;
    return {
        refNo: overrides?.refNo ?? form?.ref_no ?? "",
        employeeName: toFullName(userRow),
        date: overrides?.date ?? "",
        position,
        ...(company === undefined ? {} : {
            company_name: company.company_name,
            company_address: company.company_address ?? null,
            logo_data_url: company.logo_data_url ?? null,
        }),
        roles: items.map((item) => ({
            label: item.label_snapshot,
            signeeName: item.signatory_id === null
                ? ""
                : (signerNames.get(item.signatory_id) ?? ""),
            signatureDataUrl: null,
            remarks: item.remarks ?? "",
        })),
    };
}

export async function issueClearanceForm(input: IssueClearanceFormInput): Promise<IssueClearanceFormResult> {
    const companyCode = input.companyCode.trim();
    if (!Number.isInteger(input.requestId) || input.requestId <= 0 || companyCode === "") {
        fail(CLEARANCE_FORM_ERROR_CODES.invalidInput, "requestId and companyCode are required");
    }
    const form = await ensureClearanceForm(input.requestId, input.actorId);
    if (form.status === "issued") {
        fail(CLEARANCE_FORM_ERROR_CODES.formIssued, `clearance_form ${form.id} is already issued`);
    }
    let ref: DocumentRefRow;
    try {
        ref = await allocateDocumentRef({
            documentId: form.id,
            companyCode,
            actorId: input.actorId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith("DOCUMENT_REF_ALLOC_FAILED")) {
            fail(CLEARANCE_FORM_ERROR_CODES.refAllocFailed, message);
        }
        throw error;
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_form/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
            status: "issued",
            ref_no: ref.ref_no,
            company_code: companyCode,
            issued_at: now,
            issued_by: input.actorId,
            updated_at: now,
            updated_by: input.actorId,
        }),
    });
    const updated = isRecord(body) && !Array.isArray(body.data) ? normalizeFormRow(body.data) : null;
    if (!updated) {
        fail(CLEARANCE_FORM_ERROR_CODES.writeFailed, `clearance_form/${form.id} issue failed`);
    }
    const renderModel = await buildClearanceFormRenderModel(input.requestId, {
        date: input.date ?? "",
        refNo: ref.ref_no,
    });
    return { form: updated, ref, renderModel };
}

export async function attachClearanceFormPdf(
    formId: number,
    pdfFileId: string,
    actorId: number | null
): Promise<ClearanceFormRow> {
    if (!Number.isInteger(formId) || formId <= 0 || pdfFileId.trim() === "") {
        fail(CLEARANCE_FORM_ERROR_CODES.invalidInput, "formId and pdfFileId are required");
    }
    const current = await readFormRow(formId);
    if (!current) {
        fail(CLEARANCE_FORM_ERROR_CODES.formNotFound, `clearance_form ${formId} does not exist`);
    }
    if (current.status !== "issued") {
        fail(CLEARANCE_FORM_ERROR_CODES.formNotFound, `clearance_form ${formId} is not issued`);
    }
    if (current.pdf_file !== null && current.pdf_file !== "") {
        fail(CLEARANCE_FORM_ERROR_CODES.formFrozen, `clearance_form ${formId} pdf is frozen`);
    }
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_form/${formId}`, {
        method: "PATCH",
        body: JSON.stringify({ pdf_file: pdfFileId, updated_at: now, updated_by: actorId }),
    });
    const updated = isRecord(body) && !Array.isArray(body.data) ? normalizeFormRow(body.data) : null;
    if (!updated) {
        fail(CLEARANCE_FORM_ERROR_CODES.writeFailed, `clearance_form/${formId} pdf attach failed`);
    }
    return updated;
}

export async function listClearanceForms(query: {
    page?: number;
    limit?: number;
    status?: ClearanceFormStatus;
}): Promise<ClearanceFormListResult> {
    const page = query.page !== undefined && Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = query.limit !== undefined && Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : 25;
    if (query.status !== undefined && !toFormStatus(query.status)) {
        fail(CLEARANCE_FORM_ERROR_CODES.invalidInput, "status must be draft or issued");
    }
    const filters: string[] = [];
    if (query.status !== undefined) filters.push(`filter[status][_eq]=${query.status}`);
    filters.push("sort=-id", `limit=${limit}`, `offset=${(page - 1) * limit}`, "meta=total_count");
    const body: unknown = await dFetch(`/items/clearance_form?${filters.join("&")}`);
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_form list failed");
    }
    const rows: ClearanceFormRow[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeFormRow(entry);
        if (row) rows.push(row);
    }
    const meta: unknown = (body as { meta?: unknown }).meta;
    const total = isRecord(meta) && toId(meta.total_count) !== null
        ? (toId(meta.total_count) as number)
        : rows.length;
    return { data: rows, total, page, limit };
}

export interface ClearanceFormOverviewRow {
    request_id: number;
    employee_name: string;
    template_code: string | null;
    template_title: string | null;
    request_status: string;
    status: ClearanceFormStatus | "missing";
    form_id: number | null;
    ref_no: string | null;
    company_code: string | null;
    created_at: string | null;
}

export interface ClearanceFormOverviewResult {
    data: ClearanceFormOverviewRow[];
    total: number;
    page: number;
    limit: number;
}

export type ClearanceFormOverviewStatusFilter = ClearanceFormStatus | "missing";

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

function toOverviewStatus(value: unknown): ClearanceFormOverviewStatusFilter | null {
    if (value === "missing") return "missing";
    return toFormStatus(value);
}

async function readOverviewRequestPage(page: number, limit: number): Promise<{ rows: OverviewRequestRef[]; total: number }> {
    const body: unknown = await dFetch(
        `/items/clearance_request?sort=-id&limit=${limit}&offset=${(page - 1) * limit}&meta=total_count&fields=${OVERVIEW_REQUEST_FIELDS}`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_request list failed");
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
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_request list failed");
    }
    const rows: OverviewRequestRef[] = [];
    for (const entry of (body as { data: unknown[] }).data) {
        const row = toOverviewRequest(entry);
        if (row) rows.push(row);
    }
    return rows;
}

async function readFormsForRequests(requestIds: number[]): Promise<Map<number, ClearanceFormRow>> {
    const byRequest = new Map<number, ClearanceFormRow>();
    if (requestIds.length === 0) return byRequest;
    const body: unknown = await dFetch(
        `/items/clearance_form?filter[request_id][_in]=${requestIds.join(",")}&limit=-1`
    );
    if (!isRecord(body) || !Array.isArray(body.data)) {
        fail(CLEARANCE_FORM_ERROR_CODES.readFailed, "clearance_form list failed");
    }
    for (const entry of (body as { data: unknown[] }).data) {
        const row = normalizeFormRow(entry);
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
    form: ClearanceFormRow | undefined,
    names: Map<number, string>
): ClearanceFormOverviewRow {
    return {
        request_id: request.id,
        employee_name: names.get(request.user_id) ?? "Unknown employee",
        template_code: request.template_code,
        template_title: request.template_title,
        request_status: request.request_status,
        status: form ? form.status : "missing",
        form_id: form ? form.id : null,
        ref_no: form ? form.ref_no : null,
        company_code: form ? form.company_code : null,
        created_at: form ? form.created_at : request.created_at,
    };
}

export async function listClearanceFormOverview(query: {
    page?: number;
    limit?: number;
    status?: ClearanceFormOverviewStatusFilter;
}): Promise<ClearanceFormOverviewResult> {
    const page = query.page !== undefined && Number.isInteger(query.page) && query.page > 0 ? query.page : 1;
    const limit = query.limit !== undefined && Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : 25;
    if (query.status !== undefined && !toOverviewStatus(query.status)) {
        fail(CLEARANCE_FORM_ERROR_CODES.invalidInput, "status must be missing, draft or issued");
    }
    if (query.status === undefined) {
        const { rows: requests, total } = await readOverviewRequestPage(page, limit);
        const forms = await readFormsForRequests(requests.map((request) => request.id));
        const names = await readOverviewUserNames([...new Set(requests.map((request) => request.user_id))]);
        return {
            data: requests.map((request) => toOverviewRow(request, forms.get(request.id), names)),
            total,
            page,
            limit,
        };
    }
    const requests = await readAllOverviewRequests();
    const forms = await readFormsForRequests(requests.map((request) => request.id));
    const joined = requests.map((request) => ({ request, form: forms.get(request.id) }));
    const filtered = joined.filter(({ form }) => (form ? form.status : "missing") === query.status);
    const total = filtered.length;
    const slice = filtered.slice((page - 1) * limit, page * limit);
    const names = await readOverviewUserNames([...new Set(slice.map(({ request }) => request.user_id))]);
    return {
        data: slice.map(({ request, form }) => toOverviewRow(request, form, names)),
        total,
        page,
        limit,
    };
}

export function readClearanceFormSeparation(requestId: number): Promise<string> {
    return readRequestRef(requestId).then(async (request) => {
        if (!request) {
            fail(CLEARANCE_FORM_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
        }
        return readResignationDate(request.resignation_id);
    });
}

export function mapClearanceFormError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_FORM_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_FORM_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "Employee not found" },
                { status: 404 }
            );
        case CLEARANCE_FORM_ERROR_CODES.formNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance form not found" },
                { status: 404 }
            );
        case CLEARANCE_FORM_ERROR_CODES.invalidInput:
        case "DOCUMENT_REF_INVALID_INPUT":
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_FORM_ERROR_CODES.formIssued:
        case CLEARANCE_FORM_ERROR_CODES.formFrozen:
        case CLEARANCE_FORM_ERROR_CODES.refAllocFailed:
        case "DOCUMENT_REF_ALLOC_FAILED":
            return NextResponse.json({ success: false, code, message: "The clearance form cannot be issued" }, { status: 409 });
        default:
            return null;
    }
}
