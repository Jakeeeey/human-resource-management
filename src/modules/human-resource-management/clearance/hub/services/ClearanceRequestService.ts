import { NextResponse } from "next/server";

import { CLEARANCE_SIGNER_TYPES, type ClearanceSignerType } from "../types";
import { dFetch } from "../utils/directus";
import { nowUTC } from "../utils/audit";

export const CLEARANCE_REQUEST_ERROR_CODES = {
    invalidInput: "CLEARANCE_INVALID_INPUT",
    resignationNotFound: "RESIGNATION_NOT_FOUND",
    templateNotFound: "CLEARANCE_TEMPLATE_NOT_FOUND",
    soaTemplateNotFound: "SOA_TEMPLATE_NOT_FOUND",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    itemNotFound: "CLEARANCE_ITEM_NOT_FOUND",
    resignationNotApproved: "RESIGNATION_NOT_APPROVED",
    templateEmpty: "TEMPLATE_EMPTY",
    requestCompleted: "REQUEST_COMPLETED",
    itemSigned: "ITEM_SIGNED",
    itemNotSigned: "ITEM_NOT_SIGNED",
    notAPool: "NOT_A_POOL",
    departmentRequired: "DEPARTMENT_REQUIRED",
    writeFailed: "CLEARANCE_WRITE_FAILED",
    readFailed: "CLEARANCE_READ_FAILED",
} as const;

export interface ClearanceRequestRow {
    id: number;
    resignation_id: number;
    user_id: number;
    template_id: number;
    template_code_snapshot: string | null;
    template_title_snapshot: string | null;
    soa_template_id: number | null;
    soa_template_code_snapshot: string | null;
    soa_template_title_snapshot: string | null;
    status: string;
    confirmed_by: number | null;
    confirmed_at: string | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceItemRow {
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
    signatory_id: number | null;
    remarks: string | null;
    created_at: string | null;
    created_by: number | null;
    updated_at: string | null;
    updated_by: number | null;
}

export interface ClearanceRequestDetail extends ClearanceRequestRow {
    items: ClearanceItemRow[];
    signed_count: number;
    total_count: number;
    cleared: boolean;
}

export interface ClearanceRequestCounts {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
}

export interface ClearanceRequestListQuery {
    status?: string;
    resignationId?: number;
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface ClearanceRequestListResult {
    data: ClearanceRequestDetail[];
    counts: ClearanceRequestCounts;
    total: number;
    page: number;
    limit: number;
}

export interface ClearanceCandidate {
    user_id: number;
    full_name: string;
    is_department_head: boolean;
    department_name: string | null;
}

export interface ApprovedResignationOption {
    id: number;
    user_id: number;
    employee_name: string;
    department_id: number | null;
    department_name: string | null;
    filed_at: string | null;
    resignation_date: string | null;
    has_clearance: boolean;
}

export interface AssignClearanceRequestInput {
    resignationId: number;
    templateId: number;
    soaTemplateId: number | null;
    actorId: number | null;
}

export interface AssignClearanceRequestResult {
    request: ClearanceRequestDetail;
    created: boolean;
}

export interface UpdateClearanceItemInput {
    label?: string;
    signerType?: ClearanceSignerType;
    departmentId?: number | null;
}

interface CategoryRow {
    id: number;
    label: string;
    instructions: string | null;
    signer_type: ClearanceSignerType;
    department_id: number | null;
    sort_order: number;
}

interface ResignationRef {
    id: number;
    user_id: number;
    status: string;
}

const CLEARANCE_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_department,isDeleted";

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

function toActive(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
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

function toFullName(row: Record<string, unknown>): string {
    const parts = [row.user_fname, row.user_mname, row.user_lname].filter(
        (part): part is string => typeof part === "string" && part.trim() !== ""
    );
    const name = parts.join(" ").trim();
    return name === "" ? "Unnamed team member" : name;
}

function normalizeRequestRow(raw: unknown): ClearanceRequestRow | null {
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
        soa_template_id: toNullableId(raw.soa_template_id),
        soa_template_code_snapshot: toNullableText(raw.soa_template_code_snapshot),
        soa_template_title_snapshot: toNullableText(raw.soa_template_title_snapshot),
        status: typeof raw.status === "string" ? raw.status : "pending",
        confirmed_by: toNullableId(raw.confirmed_by),
        confirmed_at: toNullableText(raw.confirmed_at),
        created_at: toNullableText(raw.created_at),
        created_by: toNullableId(raw.created_by),
        updated_at: toNullableText(raw.updated_at),
        updated_by: toNullableId(raw.updated_by),
    };
}

function normalizeItemRow(raw: unknown): ClearanceItemRow | null {
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
        signatory_id: toNullableId(raw.signatory_id),
        remarks: toNullableText(raw.remarks),
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
        fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, `${label} read failed (${JSON.stringify(body).slice(0, 300)})`);
    }
    const rows: Record<string, unknown>[] = [];
    for (const entry of data) {
        if (isRecord(entry)) rows.push(entry);
    }
    return rows;
}

async function readListWithMeta(path: string, label: string): Promise<{ rows: Record<string, unknown>[]; total: number | null }> {
    const body: unknown = await dFetch(path);
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, `${label} read failed (${JSON.stringify(body).slice(0, 300)})`);
    }
    const rows: Record<string, unknown>[] = [];
    for (const entry of data) {
        if (isRecord(entry)) rows.push(entry);
    }
    const meta: unknown = isRecord(body) ? body.meta : null;
    const filterCount = isRecord(meta) ? toId(meta.filter_count) : null;
    const totalCount = isRecord(meta) ? toId(meta.total_count) : null;
    return { rows, total: filterCount ?? totalCount };
}

async function readResignationRef(id: number): Promise<ResignationRef | null> {
    const row = await readSingleOrNull(`/items/resignation_request/${id}?fields=id,user_id,status`);
    if (!row) return null;
    const rowId = toId(row.id);
    const userId = toId(row.user_id);
    if (rowId === null || userId === null) return null;
    return { id: rowId, user_id: userId, status: typeof row.status === "string" ? row.status : "" };
}

async function readTemplateRef(id: number): Promise<{ id: number; code: string; title: string } | null> {
    const row = await readSingleOrNull(`/items/clearance_template/${id}?fields=id,code,title`);
    if (!row) return null;
    const rowId = toId(row.id);
    const code = toNullableText(row.code);
    const title = toNullableText(row.title);
    if (rowId === null || code === null || title === null) return null;
    return { id: rowId, code, title };
}

async function readSoaTemplateRef(id: number): Promise<{ id: number; code: string; title: string } | null> {
    const row = await readSingleOrNull(`/items/clearance_soa_template/${id}?fields=id,code,title`);
    if (!row) return null;
    const rowId = toId(row.id);
    const code = toNullableText(row.code);
    const title = toNullableText(row.title);
    if (rowId === null || code === null || title === null) return null;
    return { id: rowId, code, title };
}

async function listActiveCategories(templateId: number): Promise<CategoryRow[]> {
    const raws = await readListRaw(
        `/items/clearance_category?filter[template_id][_eq]=${templateId}&filter[is_active][_eq]=1&sort=sort_order,id&limit=-1`,
        "clearance_category"
    );
    const rows: CategoryRow[] = [];
    for (const raw of raws) {
        if (!toActive(raw.is_active)) continue;
        const id = toId(raw.id);
        const label = toNullableText(raw.label);
        const signerType = toSignerType(raw.signer_type);
        if (id === null || label === null || signerType === null) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_category row contract mismatch");
        }
        rows.push({
            id,
            label,
            instructions: toNullableText(raw.instructions),
            signer_type: signerType,
            department_id: toNullableId(raw.department_id),
            sort_order: toId(raw.sort_order) ?? 0,
        });
    }
    return rows;
}

async function listCategorySignatoryUserIds(categoryId: number): Promise<number[]> {
    const raws = await readListRaw(
        `/items/clearance_category_signatory?filter[category_id][_eq]=${categoryId}&sort=sort_order,id&limit=-1&fields=id,category_id,user_id,sort_order`,
        "clearance_category_signatory"
    );
    const ids: number[] = [];
    for (const raw of raws) {
        const userId = toId(raw.user_id);
        if (userId === null) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_category_signatory row contract mismatch");
        }
        ids.push(userId);
    }
    return ids;
}

async function findRequestByResignation(resignationId: number): Promise<ClearanceRequestRow | null> {
    const raws = await readListRaw(
        `/items/clearance_request?filter[resignation_id][_eq]=${resignationId}&limit=1`,
        "clearance_request"
    );
    for (const raw of raws) {
        const row = normalizeRequestRow(raw);
        if (row) return row;
    }
    return null;
}

async function readRequestRow(id: number): Promise<ClearanceRequestRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_request/${id}`);
    if (!raw) return null;
    return normalizeRequestRow(raw);
}

async function listItemRowsForRequests(requestIds: number[]): Promise<Map<number, ClearanceItemRow[]>> {
    const grouped = new Map<number, ClearanceItemRow[]>();
    if (requestIds.length === 0) return grouped;
    const raws = await readListRaw(
        `/items/clearance_item?filter[request_id][_in]=${requestIds.join(",")}&sort=request_id,sort_order,id&limit=-1`,
        "clearance_item"
    );
    for (const raw of raws) {
        const row = normalizeItemRow(raw);
        if (!row) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        const list = grouped.get(row.request_id) ?? [];
        list.push(row);
        grouped.set(row.request_id, list);
    }
    return grouped;
}

async function listResignationIdsForEmployeeSearch(search: string): Promise<number[]> {
    const encoded = encodeURIComponent(search);
    const userRaws = await readListRaw(
        `/items/user?filter[_or][0][user_fname][_icontains]=${encoded}&filter[_or][1][user_mname][_icontains]=${encoded}&filter[_or][2][user_lname][_icontains]=${encoded}&fields=user_id&limit=-1`,
        "user"
    );
    const userIds = [
        ...new Set(
            userRaws.map((raw) => toId(raw.user_id)).filter((id): id is number => id !== null)
        ),
    ];
    if (userIds.length === 0) return [];
    const resignationRaws = await readListRaw(
        `/items/resignation_request?filter[user_id][_in]=${userIds.join(",")}&fields=id&limit=-1`,
        "resignation_request"
    );
    return resignationRaws.map((raw) => toId(raw.id)).filter((id): id is number => id !== null);
}

async function countClearanceRequests(filters: string[]): Promise<ClearanceRequestCounts> {
    const raws = await readListRaw(
        `/items/clearance_request?${[...filters, "fields=status", "limit=-1"].join("&")}`,
        "clearance_request"
    );
    const counts: ClearanceRequestCounts = { total: raws.length, pending: 0, in_progress: 0, completed: 0 };
    for (const raw of raws) {
        if (raw.status === "pending") counts.pending += 1;
        else if (raw.status === "in_progress") counts.in_progress += 1;
        else if (raw.status === "completed") counts.completed += 1;
    }
    return counts;
}

const CLEARANCE_REQUEST_SORTS = ["id", "-id", "created_at", "-created_at", "updated_at", "-updated_at", "status", "-status"] as const;

function toRequestSort(value: unknown): string {
    if (typeof value !== "string") return "-id";
    const normalized = value.trim();
    return (CLEARANCE_REQUEST_SORTS as readonly string[]).includes(normalized) ? normalized : "-id";
}

async function listItemRows(requestId: number): Promise<ClearanceItemRow[]> {
    const raws = await readListRaw(
        `/items/clearance_item?filter[request_id][_eq]=${requestId}&sort=sort_order,id&limit=-1`,
        "clearance_item"
    );
    const rows: ClearanceItemRow[] = [];
    for (const raw of raws) {
        const row = normalizeItemRow(raw);
        if (!row) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push(row);
    }
    return rows;
}

async function readItemRow(id: number): Promise<ClearanceItemRow | null> {
    const raw = await readSingleOrNull(`/items/clearance_item/${id}`);
    if (!raw) return null;
    return normalizeItemRow(raw);
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
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_item_signatory row contract mismatch");
        }
        rows.push({ id: rowId, user_id: userId });
    }
    return rows;
}

async function createRequestRow(payload: Record<string, unknown>): Promise<ClearanceRequestRow> {
    const body: unknown = await dFetch("/items/clearance_request", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    const row = isRecord(data) ? normalizeRequestRow(data) : null;
    if (!row) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, "clearance_request create failed");
    }
    return row;
}

async function createItemRows(payloads: Record<string, unknown>[]): Promise<ClearanceItemRow[]> {
    const body: unknown = await dFetch("/items/clearance_item", {
        method: "POST",
        body: JSON.stringify(payloads),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data)) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, "clearance_item batch create failed");
    }
    const rows: ClearanceItemRow[] = [];
    for (const entry of data) {
        const row = normalizeItemRow(entry);
        if (!row) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, "clearance_item row contract mismatch after create");
        }
        rows.push(row);
    }
    return rows;
}

async function createItemSignatoryRows(payloads: Record<string, unknown>[]): Promise<void> {
    const body: unknown = await dFetch("/items/clearance_item_signatory", {
        method: "POST",
        body: JSON.stringify(payloads),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    if (!Array.isArray(data) || data.length !== payloads.length) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, "clearance_item_signatory batch create failed");
    }
}

async function patchRequestRow(id: number, patch: Record<string, unknown>): Promise<ClearanceRequestRow> {
    const body: unknown = await dFetch(`/items/clearance_request/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    const row = isRecord(data) ? normalizeRequestRow(data) : null;
    if (!row) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, `clearance_request/${id} update failed`);
    }
    return row;
}

async function patchItemRow(id: number, patch: Record<string, unknown>): Promise<ClearanceItemRow> {
    const body: unknown = await dFetch(`/items/clearance_item/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    const row = isRecord(data) ? normalizeItemRow(data) : null;
    if (!row) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.writeFailed, `clearance_item/${id} update failed`);
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
    return readSingleOrNull(`/items/user/${userId}?fields=${CLEARANCE_USER_FIELDS}`);
}

async function listUserRecordsByDepartment(departmentId: number): Promise<Record<string, unknown>[]> {
    return readListRaw(
        `/items/user?filter[user_department][_eq]=${departmentId}&fields=${CLEARANCE_USER_FIELDS}&limit=-1`,
        "user"
    );
}

async function listAllUserRecords(): Promise<Record<string, unknown>[]> {
    return readListRaw(`/items/user?fields=${CLEARANCE_USER_FIELDS}&limit=-1`, "user");
}

async function readDepartmentHeadId(departmentId: number): Promise<number | null> {
    const row = await readSingleOrNull(`/items/department/${departmentId}?fields=department_id,department_head_id`);
    if (!row) return null;
    return toNullableId(row.department_head_id);
}

async function readDepartmentName(departmentId: number): Promise<string | null> {
    const row = await readSingleOrNull(`/items/department/${departmentId}?fields=department_id,department_name`);
    if (!row) return null;
    return toNullableText(row.department_name);
}

function toDetail(request: ClearanceRequestRow, items: ClearanceItemRow[]): ClearanceRequestDetail {
    const signed = items.filter((item) => item.status === "signed").length;
    return {
        ...request,
        items,
        signed_count: signed,
        total_count: items.length,
        cleared: request.status === "completed",
    };
}

export async function getClearanceRequestDetail(id: number): Promise<ClearanceRequestDetail> {
    const request = await readRequestRow(id);
    if (!request) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${id} does not exist`);
    }
    return toDetail(request, await listItemRows(id));
}

export async function readClearanceItemRequest(itemId: number): Promise<ClearanceRequestRow | null> {
    const item = await readItemRow(itemId);
    if (!item) return null;
    return readRequestRow(item.request_id);
}

export async function listClearanceRequests(query: ClearanceRequestListQuery): Promise<ClearanceRequestListResult> {
    const filters: string[] = [];
    if (query.status !== undefined && query.status !== "") {
        if (query.status === "not_completed") {
            filters.push("filter[status][_neq]=completed");
        } else {
            filters.push(`filter[status][_eq]=${encodeURIComponent(query.status)}`);
        }
    }
    if (query.resignationId !== undefined) filters.push(`filter[resignation_id][_eq]=${query.resignationId}`);
    const search = query.search?.trim() ?? "";
    if (search !== "") {
        const encoded = encodeURIComponent(search);
        filters.push(`filter[_or][0][template_title_snapshot][_icontains]=${encoded}`);
        filters.push(`filter[_or][1][template_code_snapshot][_icontains]=${encoded}`);
        filters.push(`filter[_or][2][soa_template_title_snapshot][_icontains]=${encoded}`);
        const resignationIds = await listResignationIdsForEmployeeSearch(search);
        if (resignationIds.length > 0) {
            filters.push(`filter[_or][3][resignation_id][_in]=${resignationIds.join(",")}`);
        } else {
            filters.push("filter[_or][3][resignation_id][_eq]=-1");
        }
    }
    const dateFrom = query.dateFrom?.trim() ?? "";
    if (dateFrom !== "") filters.push(`filter[created_at][_gte]=${encodeURIComponent(dateFrom)}`);
    const dateTo = query.dateTo?.trim() ?? "";
    if (dateTo !== "") filters.push(`filter[created_at][_lte]=${encodeURIComponent(dateTo)}`);
    const page = query.page ?? 1;
    const limit = query.limit ?? -1;
    const paging = limit > 0 ? `limit=${limit}&page=${page}` : "limit=-1";
    const { rows: raws, total: metaTotal } = await readListWithMeta(
        `/items/clearance_request?${[...filters, `sort=${encodeURIComponent(toRequestSort(query.sort))}`, paging, "meta=filter_count"].join("&")}`,
        "clearance_request"
    );
    const requests: ClearanceRequestRow[] = [];
    for (const raw of raws) {
        const request = normalizeRequestRow(raw);
        if (!request) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "clearance_request row contract mismatch");
        }
        requests.push(request);
    }
    const itemsByRequest = await listItemRowsForRequests(requests.map((request) => request.id));
    const details = requests.map((request) => toDetail(request, itemsByRequest.get(request.id) ?? []));
    const counts = await countClearanceRequests(filters);
    return {
        data: details,
        counts,
        total: metaTotal ?? (limit > 0 ? details.length : counts.total),
        page,
        limit,
    };
}

export async function assignClearanceRequest(input: AssignClearanceRequestInput): Promise<AssignClearanceRequestResult> {
    const resignation = await readResignationRef(input.resignationId);
    if (!resignation) {
        fail(
            CLEARANCE_REQUEST_ERROR_CODES.resignationNotFound,
            `resignation_request ${input.resignationId} does not exist`
        );
    }
    if (resignation.status !== "approved") {
        fail(
            CLEARANCE_REQUEST_ERROR_CODES.resignationNotApproved,
            `resignation_request ${input.resignationId} is not approved`
        );
    }
    const existing = await findRequestByResignation(input.resignationId);
    if (existing) {
        return { request: toDetail(existing, await listItemRows(existing.id)), created: false };
    }
    const template = await readTemplateRef(input.templateId);
    if (!template) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.templateNotFound, `clearance_template ${input.templateId} does not exist`);
    }
    const soaTemplate = input.soaTemplateId === null || input.soaTemplateId === undefined
        ? null
        : await readSoaTemplateRef(input.soaTemplateId);
    if (input.soaTemplateId !== null && input.soaTemplateId !== undefined && !soaTemplate) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.soaTemplateNotFound, `clearance_soa_template ${input.soaTemplateId} does not exist`);
    }
    const categories = await listActiveCategories(input.templateId);
    if (categories.length === 0) {
        fail(
            CLEARANCE_REQUEST_ERROR_CODES.templateEmpty,
            `clearance_template ${input.templateId} has no active categories`
        );
    }
    const now = nowUTC();
    let request: ClearanceRequestRow;
    try {
        request = await createRequestRow({
            resignation_id: input.resignationId,
            user_id: resignation.user_id,
            template_id: input.templateId,
            template_code_snapshot: template.code,
            template_title_snapshot: template.title,
            soa_template_id: soaTemplate ? soaTemplate.id : null,
            soa_template_code_snapshot: soaTemplate ? soaTemplate.code : null,
            soa_template_title_snapshot: soaTemplate ? soaTemplate.title : null,
            status: "pending",
            confirmed_by: null,
            confirmed_at: null,
            created_at: now,
            created_by: input.actorId,
        });
    } catch (error) {
        const raced = await findRequestByResignation(input.resignationId);
        if (raced) return { request: toDetail(raced, await listItemRows(raced.id)), created: false };
        throw error;
    }
    const departmentIds = [
        ...new Set(categories.map((category) => category.department_id).filter((id): id is number => id !== null)),
    ];
    const nameEntries = await Promise.all(
        departmentIds.map(async (departmentId) => ({ departmentId, name: await readDepartmentName(departmentId) }))
    );
    const namesByDepartment = new Map<number, string | null>();
    for (const entry of nameEntries) namesByDepartment.set(entry.departmentId, entry.name);
    await createItemRows(
        categories.map((category) => ({
            request_id: request.id,
            category_id: category.id,
            label_snapshot: category.label,
            instructions_snapshot: category.instructions,
            signer_type_snapshot: category.signer_type,
            department_id_snapshot: category.department_id,
            department_name_snapshot:
                category.department_id === null ? null : (namesByDepartment.get(category.department_id) ?? null),
            sort_order: category.sort_order,
            status: "pending",
            signatory_id: null,
            remarks: null,
            created_at: now,
            created_by: input.actorId,
        }))
    );
    const items = await listItemRows(request.id);
    if (items.length !== categories.length) {
        fail(
            CLEARANCE_REQUEST_ERROR_CODES.writeFailed,
            `clearance fan-out wrote ${items.length} of ${categories.length} items`
        );
    }
    const itemsByCategory = new Map<number, ClearanceItemRow>();
    for (const item of items) itemsByCategory.set(item.category_id, item);
    const signatoryPayloads: Record<string, unknown>[] = [];
    for (const category of categories) {
        if (category.signer_type !== "pool") continue;
        const item = itemsByCategory.get(category.id);
        if (!item) continue;
        const signatoryUserIds = await listCategorySignatoryUserIds(category.id);
        for (const userId of signatoryUserIds) {
            const existingPayload = signatoryPayloads.find(
                (payload) => payload.item_id === item.id && payload.user_id === userId
            );
            if (existingPayload) continue;
            signatoryPayloads.push({
                item_id: item.id,
                user_id: userId,
                sort_order: signatoryPayloads.filter((payload) => payload.item_id === item.id).length,
                created_at: now,
                created_by: input.actorId,
            });
        }
    }
    if (signatoryPayloads.length > 0) {
        await createItemSignatoryRows(signatoryPayloads);
    }
    await appendEvent({
        request_id: request.id,
        item_id: null,
        event_type: "assigned",
        actor_id: input.actorId,
        reason: null,
        payload: { template_id: input.templateId, soa_template_id: soaTemplate ? soaTemplate.id : null, item_count: items.length },
    });
    return { request: toDetail(request, items), created: true };
}

export async function updateClearanceRequestTitle(
    id: number,
    title: string,
    actorId: number | null
): Promise<ClearanceRequestDetail> {
    const current = await readRequestRow(id);
    if (!current) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${id} does not exist`);
    }
    if (current.status === "completed") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestCompleted, `clearance_request ${id} is completed`);
    }
    const now = nowUTC();
    const updated = await patchRequestRow(id, {
        template_title_snapshot: title,
        updated_at: now,
        updated_by: actorId,
    });
    await appendEvent({
        request_id: id,
        item_id: null,
        event_type: "edited",
        actor_id: actorId,
        reason: null,
        payload: { fields: ["template_title_snapshot"] },
    });
    return toDetail(updated, await listItemRows(id));
}

export async function updateClearanceItem(
    id: number,
    input: UpdateClearanceItemInput,
    actorId: number | null
): Promise<ClearanceItemRow> {
    const current = await readItemRow(id);
    if (!current) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.itemNotFound, `clearance_item ${id} does not exist`);
    }
    const request = await readRequestRow(current.request_id);
    if (!request) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${current.request_id} does not exist`);
    }
    if (request.status === "completed") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestCompleted, `clearance_request ${request.id} is completed`);
    }
    const touchesIdentity = input.signerType !== undefined || input.departmentId !== undefined;
    if (current.status === "signed" && touchesIdentity) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.itemSigned, `clearance_item ${id} is signed`);
    }
    const signerType = input.signerType ?? current.signer_type_snapshot;
    const departmentId = input.departmentId !== undefined ? input.departmentId : current.department_id_snapshot;
    if (signerType === "named_department" && departmentId === null) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.departmentRequired, "named_department requires department_id");
    }
    const patch: Record<string, unknown> = { updated_at: nowUTC(), updated_by: actorId };
    const fields: string[] = [];
    if (input.label !== undefined) {
        patch.label_snapshot = input.label;
        fields.push("label_snapshot");
    }
    if (input.signerType !== undefined) {
        patch.signer_type_snapshot = input.signerType;
        fields.push("signer_type_snapshot");
    }
    if (input.departmentId !== undefined) {
        patch.department_id_snapshot = input.departmentId;
        patch.department_name_snapshot =
            input.departmentId === null ? null : await readDepartmentName(input.departmentId);
        fields.push("department_id_snapshot");
    }
    const updated = await patchItemRow(id, patch);
    await appendEvent({
        request_id: current.request_id,
        item_id: id,
        event_type: "edited",
        actor_id: actorId,
        reason: null,
        payload: { fields },
    });
    return updated;
}

export async function replaceItemSignatories(
    requestId: number,
    itemId: number,
    userIds: number[],
    actorId: number | null
): Promise<{ id: number; user_id: number }[]> {
    const request = await readRequestRow(requestId);
    if (!request) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const item = await readItemRow(itemId);
    if (!item || item.request_id !== requestId) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.itemNotFound, `clearance_item ${itemId} does not exist`);
    }
    if (request.status === "completed") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestCompleted, `clearance_request ${requestId} is completed`);
    }
    if (item.status === "signed") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.itemSigned, `clearance_item ${itemId} is signed`);
    }
    if (item.signer_type_snapshot !== "pool") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.notAPool, `clearance_item ${itemId} is not a pool`);
    }
    const uniqueIds = [...new Set(userIds)];
    const existing = await listItemSignatoryRows(itemId);
    const existingIds = existing.map((row) => row.id);
    if (existingIds.length > 0) {
        await dFetch("/items/clearance_item_signatory", {
            method: "DELETE",
            body: JSON.stringify(existingIds),
        });
    }
    const now = nowUTC();
    await createItemSignatoryRows(
        uniqueIds.map((userId, index) => ({
            item_id: itemId,
            user_id: userId,
            sort_order: index,
            created_at: now,
            created_by: actorId,
        }))
    );
    await appendEvent({
        request_id: requestId,
        item_id: itemId,
        event_type: "edited",
        actor_id: actorId,
        reason: null,
        payload: { fields: ["signatories"], user_ids: uniqueIds },
    });
    return listItemSignatoryRows(itemId);
}

export async function confirmClearanceRequest(id: number, actorId: number | null): Promise<ClearanceRequestDetail> {
    const current = await readRequestRow(id);
    if (!current) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${id} does not exist`);
    }
    if (current.status === "completed") {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestCompleted, `clearance_request ${id} is completed`);
    }
    const now = nowUTC();
    const updated = await patchRequestRow(id, {
        status: "completed",
        confirmed_by: actorId,
        confirmed_at: now,
        updated_at: now,
        updated_by: actorId,
    });
    await appendEvent({
        request_id: id,
        item_id: null,
        event_type: "confirmed",
        actor_id: actorId,
        reason: null,
        payload: { confirmed_by: actorId },
    });
    return toDetail(updated, await listItemRows(id));
}

export async function syncClearanceRequestCompletion(requestId: number, actorId: number | null): Promise<void> {
    const request = await readRequestRow(requestId);
    if (!request) return;
    const [formBody, soaBody, quitBody] = await Promise.all([
        dFetch(`/items/clearance_form?filter[request_id][_eq]=${requestId}&fields=status&limit=1`),
        dFetch(`/items/clearance_soa?filter[request_id][_eq]=${requestId}&fields=status&limit=1`),
        dFetch(`/items/clearance_quitclaim?filter[request_id][_eq]=${requestId}&fields=status&limit=1`),
    ]);
    function firstStatus(body: unknown): string | null {
        if (!isRecord(body) || !Array.isArray(body.data) || body.data.length === 0) return null;
        const first: unknown = body.data[0];
        if (!isRecord(first) || typeof first.status !== "string") return null;
        return first.status;
    }
    const allApproved = firstStatus(formBody) === "approved" &&
        firstStatus(soaBody) === "approved" &&
        firstStatus(quitBody) === "approved";
    const now = nowUTC();
    if (allApproved) {
        if (request.status !== "completed") {
            await patchRequestRow(requestId, { status: "completed", updated_at: now, updated_by: actorId });
        }
        return;
    }
    if (request.status === "completed") {
        await patchRequestRow(requestId, { status: "in_progress", updated_at: now, updated_by: actorId });
    }
}

export async function resolveCandidateSet(itemId: number): Promise<ClearanceCandidate[]> {
    const item = await readItemRow(itemId);
    if (!item) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.itemNotFound, `clearance_item ${itemId} does not exist`);
    }
    const request = await readRequestRow(item.request_id);
    if (!request) {
        fail(CLEARANCE_REQUEST_ERROR_CODES.requestNotFound, `clearance_request ${item.request_id} does not exist`);
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
        ...new Set(records.map((record) => toDepartmentId(record.user_department)).filter((id): id is number => id !== null)),
    ];
    const headEntries = await Promise.all(
        departmentIds.map(async (departmentId) => ({ departmentId, headId: await readDepartmentHeadId(departmentId) }))
    );
    const headByDepartment = new Map<number, number | null>();
    for (const entry of headEntries) headByDepartment.set(entry.departmentId, entry.headId);
    const nameEntries = await Promise.all(
        departmentIds.map(async (departmentId) => ({ departmentId, name: await readDepartmentName(departmentId) }))
    );
    const nameByDepartment = new Map<number, string | null>();
    for (const entry of nameEntries) nameByDepartment.set(entry.departmentId, entry.name);
    const candidates: ClearanceCandidate[] = [];
    for (const record of records) {
        const userId = toId(record.user_id);
        if (userId === null || userId === subjectId) continue;
        if (isDeletedUser(record)) continue;
        const departmentId = toDepartmentId(record.user_department);
        const headId = departmentId === null ? null : (headByDepartment.get(departmentId) ?? null);
        const departmentName = departmentId === null ? null : (nameByDepartment.get(departmentId) ?? null);
        candidates.push({
            user_id: userId,
            full_name: toFullName(record),
            is_department_head: headId !== null && headId === userId,
            department_name: departmentName,
        });
    }
    candidates.sort((left, right) => left.full_name.localeCompare(right.full_name) || left.user_id - right.user_id);
    return candidates;
}

export async function listApprovedResignationsForAssignment(): Promise<ApprovedResignationOption[]> {
    const [resignationRaws, clearanceRaws] = await Promise.all([
        readListRaw(
            "/items/resignation_request?filter[status][_eq]=approved&sort=-filed_at&limit=-1&fields=id,user_id,status,filed_at,resignation_date",
            "resignation_request"
        ),
        readListRaw("/items/clearance_request?fields=resignation_id&limit=-1", "clearance_request"),
    ]);
    const clearedIds = new Set<number>();
    for (const raw of clearanceRaws) {
        const resignationId = toId(raw.resignation_id);
        if (resignationId !== null) clearedIds.add(resignationId);
    }
    const userIds = [
        ...new Set(
            resignationRaws.map((raw) => toId(raw.user_id)).filter((id): id is number => id !== null)
        ),
    ];
    const userEntries = await Promise.all(
        userIds.map(async (userId) => ({ userId, row: await readUserRecord(userId) }))
    );
    const usersById = new Map<number, Record<string, unknown>>();
    for (const entry of userEntries) {
        if (entry.row) usersById.set(entry.userId, entry.row);
    }
    const departmentIds = [
        ...new Set(
            [...usersById.values()]
                .map((row) => toDepartmentId(row.user_department))
                .filter((id): id is number => id !== null)
        ),
    ];
    const departmentEntries = await Promise.all(
        departmentIds.map(async (departmentId) => ({ departmentId, name: await readDepartmentName(departmentId) }))
    );
    const namesByDepartment = new Map<number, string | null>();
    for (const entry of departmentEntries) namesByDepartment.set(entry.departmentId, entry.name);
    const options: ApprovedResignationOption[] = [];
    for (const raw of resignationRaws) {
        const id = toId(raw.id);
        const userId = toId(raw.user_id);
        if (id === null || userId === null) {
            fail(CLEARANCE_REQUEST_ERROR_CODES.readFailed, "resignation_request row contract mismatch");
        }
        const user = usersById.get(userId);
        const departmentId = user ? toDepartmentId(user.user_department) : null;
        options.push({
            id,
            user_id: userId,
            employee_name: user ? toFullName(user) : "Unknown employee",
            department_id: departmentId,
            department_name: departmentId === null ? null : (namesByDepartment.get(departmentId) ?? null),
            filed_at: toNullableText(raw.filed_at),
            resignation_date: toNullableText(raw.resignation_date),
            has_clearance: clearedIds.has(id),
        });
    }
    return options;
}

export function mapClearanceRequestError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_REQUEST_ERROR_CODES.resignationNotFound:
            return NextResponse.json(
                { success: false, code, message: "Resignation request not found" },
                { status: 404 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.templateNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance template not found" },
                { status: 404 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.soaTemplateNotFound:
            return NextResponse.json(
                { success: false, code, message: "SOA template not found" },
                { status: 404 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.itemNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance item not found" },
                { status: 404 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.invalidInput:
        case CLEARANCE_REQUEST_ERROR_CODES.departmentRequired:
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_REQUEST_ERROR_CODES.resignationNotApproved:
            return NextResponse.json(
                { success: false, code, message: "The resignation is not approved" },
                { status: 409 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.templateEmpty:
            return NextResponse.json(
                { success: false, code, message: "The template has no active categories" },
                { status: 409 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.requestCompleted:
            return NextResponse.json(
                { success: false, code, message: "The clearance request is completed" },
                { status: 409 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.itemSigned:
            return NextResponse.json(
                { success: false, code, message: "The clearance item is signed" },
                { status: 409 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.itemNotSigned:
            return NextResponse.json(
                { success: false, code, message: "The clearance item is not signed" },
                { status: 409 }
            );
        case CLEARANCE_REQUEST_ERROR_CODES.notAPool:
            return NextResponse.json(
                { success: false, code, message: "The clearance item is not a pool" },
                { status: 409 }
            );
        default:
            return null;
    }
}
