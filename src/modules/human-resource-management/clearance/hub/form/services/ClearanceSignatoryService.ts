import { NextResponse } from "next/server";

import { dFetch } from "../../utils/directus";
import { nowUTC } from "../../utils/audit";

export const CLEARANCE_SIGNATORY_ERROR_CODES = {
    invalidInput: "CLEARANCE_SIGNATORY_INVALID_INPUT",
    requestNotFound: "CLEARANCE_REQUEST_NOT_FOUND",
    itemNotFound: "CLEARANCE_ITEM_NOT_FOUND",
    userNotFound: "CLEARANCE_USER_NOT_FOUND",
    notACandidate: "CLEARANCE_NOT_A_CANDIDATE",
    requestCompleted: "REQUEST_COMPLETED",
    itemSigned: "ITEM_SIGNED",
    writeFailed: "CLEARANCE_SIGNATORY_WRITE_FAILED",
    readFailed: "CLEARANCE_SIGNATORY_READ_FAILED",
} as const;

export const FORM_SIGNER_TYPES = ["pool", "subject_department", "named_department", "all"] as const;

export type FormSignerType = (typeof FORM_SIGNER_TYPES)[number];

export interface SignatoryCandidate {
    user_id: number;
    full_name: string;
    department_name: string | null;
}

export interface SignatoryItem {
    id: number;
    request_id: number;
    category_id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    signer_type_snapshot: FormSignerType;
    department_id_snapshot: number | null;
    department_name_snapshot: string | null;
    sort_order: number;
    status: string;
    signatory_id: number | null;
}

export interface SignatoryAssignment {
    item_id: number;
    signatory_id: number | null;
}

export interface RequestSignatories {
    items: SignatoryItem[];
    candidates: Record<number, SignatoryCandidate[]>;
}

const SIGNATORY_USER_FIELDS = "user_id,user_fname,user_mname,user_lname,user_department,isDeleted";
const PAGE_LIMIT = 100;

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

function toSignerType(value: unknown): FormSignerType | null {
    if (typeof value !== "string") return null;
    return (FORM_SIGNER_TYPES as readonly string[]).includes(value) ? (value as FormSignerType) : null;
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

function normalizeItemRow(raw: unknown): SignatoryItem | null {
    if (!isRecord(raw)) return null;
    const id = toId(raw.id);
    const requestId = toId(raw.request_id);
    const categoryId = toId(raw.category_id);
    const label = toNullableText(raw.label_snapshot);
    const signerType = toSignerType(raw.signer_type_snapshot);
    if (id === null || requestId === null || categoryId === null || label === null || signerType === null) {
        return null;
    }
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
    };
}

async function readSingleOrNull(path: string): Promise<Record<string, unknown> | null> {
    const body: unknown = await dFetch(path);
    if (!isRecord(body) || hasErrors(body)) return null;
    return isRecord(body.data) ? body.data : null;
}

async function readPagedRows(basePath: string, label: string): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = [];
    let page = 1;
    for (;;) {
        const separator = basePath.includes("?") ? "&" : "?";
        const body: unknown = await dFetch(`${basePath}${separator}limit=${PAGE_LIMIT}&offset=${(page - 1) * PAGE_LIMIT}`);
        const data: unknown = isRecord(body) ? body.data : null;
        if (!Array.isArray(data)) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.readFailed, `${label} read failed`);
        }
        const batch: Record<string, unknown>[] = [];
        for (const entry of data) {
            if (isRecord(entry)) batch.push(entry);
        }
        rows.push(...batch);
        if (batch.length < PAGE_LIMIT) break;
        page += 1;
    }
    return rows;
}

async function readRequestRef(id: number): Promise<{ id: number; user_id: number; status: string } | null> {
    const row = await readSingleOrNull(`/items/clearance_request/${id}?fields=id,user_id,status`);
    if (!row) return null;
    const rowId = toId(row.id);
    const userId = toId(row.user_id);
    if (rowId === null || userId === null) return null;
    return { id: rowId, user_id: userId, status: typeof row.status === "string" ? row.status : "pending" };
}

async function listItemRows(requestId: number): Promise<SignatoryItem[]> {
    const raws = await readPagedRows(
        `/items/clearance_item?filter[request_id][_eq]=${requestId}&sort=sort_order,id`,
        "clearance_item"
    );
    const rows: SignatoryItem[] = [];
    for (const raw of raws) {
        const row = normalizeItemRow(raw);
        if (!row) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.readFailed, "clearance_item row contract mismatch");
        }
        rows.push(row);
    }
    return rows;
}

async function readUserRecord(userId: number): Promise<Record<string, unknown> | null> {
    return readSingleOrNull(`/items/user/${userId}?fields=${SIGNATORY_USER_FIELDS}`);
}

async function listUsersByDepartment(departmentId: number): Promise<Record<string, unknown>[]> {
    return readPagedRows(
        `/items/user?filter[user_department][_eq]=${departmentId}&fields=${SIGNATORY_USER_FIELDS}&sort=user_id`,
        "user"
    );
}

async function listAllUsers(): Promise<Record<string, unknown>[]> {
    return readPagedRows(`/items/user?fields=${SIGNATORY_USER_FIELDS}&sort=user_id`, "user");
}

async function listUsersByIds(userIds: number[]): Promise<Record<string, unknown>[]> {
    if (userIds.length === 0) return [];
    return readPagedRows(
        `/items/user?filter[user_id][_in]=${userIds.join(",")}&fields=${SIGNATORY_USER_FIELDS}&sort=user_id`,
        "user"
    );
}

async function listCategoryPoolUserIds(categoryId: number): Promise<number[]> {
    const raws = await readPagedRows(
        `/items/clearance_category_signatory?filter[category_id][_eq]=${categoryId}&sort=sort_order,id&fields=id,category_id,user_id,sort_order`,
        "clearance_category_signatory"
    );
    const ids: number[] = [];
    for (const raw of raws) {
        const userId = toId(raw.user_id);
        if (userId === null) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.readFailed, "clearance_category_signatory row contract mismatch");
        }
        if (!ids.includes(userId)) ids.push(userId);
    }
    return ids;
}

async function readDepartmentNames(departmentIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    if (departmentIds.length === 0) return names;
    const raws = await readPagedRows(
        `/items/department?filter[department_id][_in]=${departmentIds.join(",")}&fields=department_id,department_name`,
        "department"
    );
    for (const raw of raws) {
        const id = toDepartmentId(raw.department_id);
        const name = toNullableText(raw.department_name);
        if (id !== null && name !== null) names.set(id, name);
    }
    return names;
}

function toCandidates(
    records: Record<string, unknown>[],
    subjectId: number,
    namesByDepartment: Map<number, string>
): SignatoryCandidate[] {
    const candidates: SignatoryCandidate[] = [];
    for (const record of records) {
        const userId = toId(record.user_id);
        if (userId === null || userId === subjectId) continue;
        if (isDeletedUser(record)) continue;
        const departmentId = toDepartmentId(record.user_department);
        candidates.push({
            user_id: userId,
            full_name: toFullName(record),
            department_name: departmentId === null ? null : (namesByDepartment.get(departmentId) ?? null),
        });
    }
    candidates.sort((left, right) => left.full_name.localeCompare(right.full_name) || left.user_id - right.user_id);
    return candidates;
}

export async function getRequestSignatories(requestId: number): Promise<RequestSignatories> {
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_SIGNATORY_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    const items = await listItemRows(requestId);
    const subject = await readUserRecord(request.user_id);
    const subjectDepartmentId = subject ? toDepartmentId(subject.user_department) : null;
    const poolEntries = await Promise.all(
        items
            .filter((item) => item.signer_type_snapshot === "pool")
            .map(async (item) => ({ itemId: item.id, userIds: await listCategoryPoolUserIds(item.category_id) }))
    );
    const poolUserIds = [...new Set(poolEntries.flatMap((entry) => entry.userIds))];
    const namedDepartmentIds = [
        ...new Set(
            items
                .filter((item) => item.signer_type_snapshot === "named_department")
                .map((item) => item.department_id_snapshot)
                .filter((id): id is number => id !== null)
        ),
    ];
    const [poolUsers, allUsers, subjectDepartmentUsers, namedDepartmentUsers] = await Promise.all([
        listUsersByIds(poolUserIds),
        items.some((item) => item.signer_type_snapshot === "all") ? listAllUsers() : Promise.resolve([]),
        items.some((item) => item.signer_type_snapshot === "subject_department") && subjectDepartmentId !== null
            ? listUsersByDepartment(subjectDepartmentId)
            : Promise.resolve([]),
        Promise.all(namedDepartmentIds.map(async (departmentId) => listUsersByDepartment(departmentId))).then((pages) =>
            pages.flat()
        ),
    ]);
    const poolByItem = new Map<number, Record<string, unknown>[]>();
    const poolById = new Map<number, Record<string, unknown>>();
    for (const row of poolUsers) {
        const id = toId(row.user_id);
        if (id !== null) poolById.set(id, row);
    }
    for (const entry of poolEntries) {
        const rows: Record<string, unknown>[] = [];
        for (const userId of entry.userIds) {
            const row = poolById.get(userId);
            if (row) rows.push(row);
        }
        poolByItem.set(entry.itemId, rows);
    }
    const departmentIds = [
        ...new Set(
            [...allUsers, ...subjectDepartmentUsers, ...namedDepartmentUsers, ...poolUsers]
                .map((row) => toDepartmentId(row.user_department))
                .filter((id): id is number => id !== null)
        ),
    ];
    const namesByDepartment = await readDepartmentNames(departmentIds);
    const candidates: Record<number, SignatoryCandidate[]> = {};
    for (const item of items) {
        if (item.signer_type_snapshot === "pool") {
            candidates[item.id] = toCandidates(poolByItem.get(item.id) ?? [], request.user_id, namesByDepartment);
        } else if (item.signer_type_snapshot === "subject_department") {
            candidates[item.id] = toCandidates(subjectDepartmentUsers, request.user_id, namesByDepartment);
        } else if (item.signer_type_snapshot === "named_department") {
            const rows = item.department_id_snapshot === null
                ? []
                : namedDepartmentUsers.filter(
                    (row) => toDepartmentId(row.user_department) === item.department_id_snapshot
                );
            candidates[item.id] = toCandidates(rows, request.user_id, namesByDepartment);
        } else {
            candidates[item.id] = toCandidates(allUsers, request.user_id, namesByDepartment);
        }
    }
    return { items, candidates };
}

async function patchItemSignatory(itemId: number, signatoryId: number | null, actorId: number | null): Promise<void> {
    const now = nowUTC();
    const body: unknown = await dFetch(`/items/clearance_item/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ signatory_id: signatoryId, updated_at: now, updated_by: actorId }),
    });
    const data: unknown = isRecord(body) ? body.data : null;
    if (!isRecord(data) || normalizeItemRow(data) === null) {
        fail(CLEARANCE_SIGNATORY_ERROR_CODES.writeFailed, `clearance_item/${itemId} update failed`);
    }
}

export async function saveRequestSignatories(
    requestId: number,
    assignments: SignatoryAssignment[],
    actorId: number | null
): Promise<SignatoryItem[]> {
    if (!Number.isInteger(requestId) || requestId <= 0 || assignments.length === 0) {
        fail(CLEARANCE_SIGNATORY_ERROR_CODES.invalidInput, "requestId and assignments are required");
    }
    const request = await readRequestRef(requestId);
    if (!request) {
        fail(CLEARANCE_SIGNATORY_ERROR_CODES.requestNotFound, `clearance_request ${requestId} does not exist`);
    }
    if (request.status === "completed") {
        fail(CLEARANCE_SIGNATORY_ERROR_CODES.requestCompleted, `clearance_request ${requestId} is completed`);
    }
    const items = await listItemRows(requestId);
    const byId = new Map<number, SignatoryItem>();
    for (const item of items) byId.set(item.id, item);
    const seen = new Set<number>();
    for (const assignment of assignments) {
        if (!Number.isInteger(assignment.item_id) || assignment.item_id <= 0) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.invalidInput, "item_id must be a positive integer");
        }
        if (seen.has(assignment.item_id)) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.invalidInput, "duplicate item_id in assignments");
        }
        seen.add(assignment.item_id);
        const item = byId.get(assignment.item_id);
        if (!item) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.itemNotFound, `clearance_item ${assignment.item_id} does not exist`);
        }
        if (item.status === "signed" && item.signatory_id !== assignment.signatory_id) {
            fail(CLEARANCE_SIGNATORY_ERROR_CODES.itemSigned, `clearance_item ${assignment.item_id} is signed`);
        }
        if (assignment.signatory_id !== null) {
            if (!Number.isInteger(assignment.signatory_id) || assignment.signatory_id <= 0) {
                fail(CLEARANCE_SIGNATORY_ERROR_CODES.invalidInput, "signatory_id must be a positive integer or null");
            }
            const user = await readUserRecord(assignment.signatory_id);
            if (!user || isDeletedUser(user)) {
                fail(CLEARANCE_SIGNATORY_ERROR_CODES.userNotFound, `user ${assignment.signatory_id} does not exist`);
            }
        }
    }
    const resolved = await getRequestSignatories(requestId);
    for (const assignment of assignments) {
        if (assignment.signatory_id === null) continue;
        const allowed = resolved.candidates[assignment.item_id] ?? [];
        if (!allowed.some((candidate) => candidate.user_id === assignment.signatory_id)) {
            fail(
                CLEARANCE_SIGNATORY_ERROR_CODES.notACandidate,
                `user ${assignment.signatory_id} cannot sign clearance_item ${assignment.item_id}`
            );
        }
    }
    const changed = assignments.filter((assignment) => {
        const item = byId.get(assignment.item_id);
        return item !== undefined && item.signatory_id !== assignment.signatory_id;
    });
    await Promise.all(
        changed.map((assignment) => patchItemSignatory(assignment.item_id, assignment.signatory_id, actorId))
    );
    await dFetch("/items/clearance_event", {
        method: "POST",
        body: JSON.stringify({
            request_id: requestId,
            item_id: null,
            event_type: "edited",
            actor_id: actorId,
            reason: null,
            payload: {
                fields: ["signatory_id"],
                assignments: changed.map((assignment) => ({
                    item_id: assignment.item_id,
                    signatory_id: assignment.signatory_id,
                })),
            },
            created_at: nowUTC(),
        }),
    });
    return listItemRows(requestId);
}

export function mapClearanceSignatoryError(error: unknown): NextResponse | null {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.split(":")[0];
    switch (code) {
        case CLEARANCE_SIGNATORY_ERROR_CODES.requestNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance request not found" },
                { status: 404 }
            );
        case CLEARANCE_SIGNATORY_ERROR_CODES.itemNotFound:
            return NextResponse.json(
                { success: false, code, message: "Clearance item not found" },
                { status: 404 }
            );
        case CLEARANCE_SIGNATORY_ERROR_CODES.userNotFound:
            return NextResponse.json(
                { success: false, code, message: "Employee not found" },
                { status: 404 }
            );
        case CLEARANCE_SIGNATORY_ERROR_CODES.invalidInput:
        case CLEARANCE_SIGNATORY_ERROR_CODES.notACandidate:
            return NextResponse.json({ success: false, code, message: "Invalid request" }, { status: 400 });
        case CLEARANCE_SIGNATORY_ERROR_CODES.requestCompleted:
            return NextResponse.json(
                { success: false, code, message: "The clearance request is completed" },
                { status: 409 }
            );
        case CLEARANCE_SIGNATORY_ERROR_CODES.itemSigned:
            return NextResponse.json(
                { success: false, code, message: "The clearance item is signed" },
                { status: 409 }
            );
        default:
            return null;
    }
}
