import { NextResponse } from "next/server";

import { unwrapStudioGroupsData } from "./capability";
import { resolveEmployeeEmail } from "./emailResolution";
import { collectAllCustomerCandidates, collectAllEmployeeCandidates, readCompanyDomains } from "./memberDirectory";
import type {
    GroupSourceKind,
    MemberSort,
    MsGroupCreateBody,
    MsGroupMemberRow,
    MsGroupRow,
    MsGroupUpdateBody,
} from "../types";
import { creationTimestamps, nowUTC, stampCreate, stampUpdate } from "../utils/audit";
import { dFetch } from "../utils/directus";

export class GroupNotFoundError extends Error {
    readonly status = 404;

    constructor(message: string) {
        super(message);
        this.name = "GroupNotFoundError";
    }
}

export class GroupConflictError extends Error {
    readonly status = 409;

    constructor(message: string) {
        super(message);
        this.name = "GroupConflictError";
    }
}

export class GroupValidationError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = "GroupValidationError";
    }
}

export function toGroupErrorResponse(error: unknown): NextResponse {
    if (
        error instanceof GroupNotFoundError ||
        error instanceof GroupConflictError ||
        error instanceof GroupValidationError
    ) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

export interface AddMemberInput {
    email: string;
    source_kind: GroupSourceKind;
    source_ref?: number | null;
}

export interface AddMembersResult {
    added: MsGroupMemberRow[];
    skipped: string[];
}

export interface DeleteGroupResult {
    group: MsGroupRow;
    mode: "hard" | "soft";
}

export interface ResyncResult {
    updated: number;
    unchanged: number;
    missing: number;
}

const GROUPS = "/items/ms_groups";
const MEMBERS = "/items/ms_group_members";
const CUSTOMER = "/items/customer";
const USER = "/items/user";
const GROUP_FIELDS = "id,group_key,group_name,description,is_active,created_at,created_by,updated_at,updated_by";
const MEMBER_FIELDS = "id,group_id,email,source_kind,source_ref,is_active,created_at,created_by,updated_at,updated_by";
const INSERT_BATCH_SIZE = 200;
const DELETE_BATCH_SIZE = 200;
export const BULK_DELETE_MAX_IDS = 5000;

export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

function isDuplicateMessage(message: string): boolean {
    const text = message.toLowerCase();
    return text.includes("duplicate") || text.includes("unique") || text.includes("already exists");
}

function throwIfDirectusErrors(body: unknown, context: string): void {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        const message =
            Array.isArray(errors) && errors.length > 0
                ? errors.map((entry) => entry.message ?? "unknown error").join("; ")
                : context;
        if (isDuplicateMessage(message)) {
            throw new GroupConflictError(message);
        }
        throw new Error(`${context}: ${message}`);
    }
}

async function readGroupRow(id: number): Promise<MsGroupRow | null> {
    const body = await dFetch(`${GROUPS}?filter[id][_eq]=${id}&fields=${GROUP_FIELDS}&limit=1`);
    const rows = unwrapStudioGroupsData<MsGroupRow[]>(body);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function readMemberRows(groupId: number): Promise<MsGroupMemberRow[]> {
    const body = await dFetch(
        `${MEMBERS}?filter[group_id][_eq]=${groupId}&fields=${MEMBER_FIELDS}&sort=id&limit=-1`
    );
    const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(body);
    return Array.isArray(rows) ? rows : [];
}

async function readMemberIds(groupId: number): Promise<number[]> {
    const body = await dFetch(`${MEMBERS}?filter[group_id][_eq]=${groupId}&fields=id&limit=-1`);
    const rows = unwrapStudioGroupsData<Array<{ id?: unknown }>>(body);
    if (!Array.isArray(rows)) return [];
    const ids: number[] = [];
    for (const row of rows) {
        if (typeof row.id === "number" && Number.isInteger(row.id)) ids.push(row.id);
    }
    return ids;
}

function pickEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const email = normalizeEmail(value);
    return email === "" ? null : email;
}

async function readCustomerEmail(ref: number): Promise<string | null> {
    try {
        const body = await dFetch(`${CUSTOMER}/${ref}?fields=id,customer_email`);
        if (typeof body === "object" && body !== null && "errors" in body) return null;
        const row = unwrapStudioGroupsData<{ customer_email?: unknown } | null>(body);
        if (!row || typeof row !== "object") return null;
        return pickEmail(row.customer_email);
    } catch {
        return null;
    }
}

async function readEmployeeEmail(ref: number, companyDomains: ReadonlySet<string>): Promise<string | null> {
    try {
        const body = await dFetch(
            `${USER}?filter[user_id][_eq]=${ref}&fields=user_id,user_email,personal_email&limit=1`
        );
        const rows = unwrapStudioGroupsData<Array<{ user_email?: unknown; personal_email?: unknown }>>(body);
        const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (!row) return null;
        return resolveEmployeeEmail({ personal_email: row.personal_email, user_email: row.user_email }, companyDomains);
    } catch {
        return null;
    }
}

export async function listGroups(filter?: { isActive?: boolean }): Promise<MsGroupRow[]> {
    const clause = filter?.isActive === undefined ? "" : `&filter[is_active][_eq]=${filter.isActive}`;
    const body = await dFetch(`${GROUPS}?fields=${GROUP_FIELDS}&sort=-id&limit=-1${clause}`);
    const rows = unwrapStudioGroupsData<MsGroupRow[]>(body);
    return Array.isArray(rows) ? rows : [];
}

export async function getGroup(id: number): Promise<MsGroupRow> {
    const row = await readGroupRow(id);
    if (!row) {
        throw new GroupNotFoundError("Group not found");
    }
    return row;
}

export async function createGroup(input: MsGroupCreateBody, actor: string | null): Promise<MsGroupRow> {
    const key = input.group_key.trim();
    const lookup = await dFetch(`${GROUPS}?filter[group_key][_eq]=${encodeURIComponent(key)}&fields=id&limit=1`);
    const holders = unwrapStudioGroupsData<MsGroupRow[]>(lookup);
    if (Array.isArray(holders) && holders.length > 0) {
        throw new GroupConflictError(`group_key "${key}" is already in use`);
    }
    const payload = stampCreate(
        {
            ...creationTimestamps(),
            group_key: key,
            group_name: input.group_name.trim(),
            description: input.description ?? null,
            is_active: input.is_active ?? true,
        },
        actor
    );
    const body = await dFetch(GROUPS, { method: "POST", body: JSON.stringify(payload) });
    throwIfDirectusErrors(body, "Failed to create group");
    return unwrapStudioGroupsData<MsGroupRow>(body);
}

export async function updateGroup(id: number, patch: MsGroupUpdateBody, actor: string | null): Promise<MsGroupRow> {
    const existing = await readGroupRow(id);
    if (!existing) {
        throw new GroupNotFoundError("Group not found");
    }
    const payload = stampUpdate(
        {
            ...(patch.group_name !== undefined ? { group_name: patch.group_name.trim() } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
            updated_at: nowUTC(),
        },
        actor
    );
    const body = await dFetch(`${GROUPS}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    throwIfDirectusErrors(body, "Failed to update group");
    return unwrapStudioGroupsData<MsGroupRow>(body);
}

export async function softDeleteGroup(id: number, actor: string | null): Promise<DeleteGroupResult> {
    const existing = await readGroupRow(id);
    if (!existing) {
        throw new GroupNotFoundError("Group not found");
    }
    const members = await readMemberRows(id);
    if (members.length === 0) {
        await dFetch(`${GROUPS}/${id}`, { method: "DELETE" });
        return { group: existing, mode: "hard" };
    }
    const body = await dFetch(
        `${GROUPS}/${id}`,
        {
            method: "PATCH",
            body: JSON.stringify(stampUpdate({ is_active: false, updated_at: nowUTC() }, actor)),
        }
    );
    throwIfDirectusErrors(body, "Failed to deactivate group");
    return { group: unwrapStudioGroupsData<MsGroupRow>(body), mode: "soft" };
}

export async function listMembers(groupId: number): Promise<MsGroupMemberRow[]> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    return readMemberRows(groupId);
}

export const MEMBERS_PAGE_DEFAULT_LIMIT = 25;

export const MEMBERS_PAGE_MAX_LIMIT = 100;

const MEMBER_CHECK_MAX_EACH = 100;

const MEMBER_SORT_MAP: Record<MemberSort, string> = {
    "added-desc": "-created_at,-id",
    "added-asc": "created_at,id",
    "email-asc": "email",
    "email-desc": "-email",
    "source-asc": "source_kind",
    "source-desc": "-source_kind",
};

export interface MembersPageInput {
    page: number;
    limit: number;
    sort: MemberSort;
}

export interface MembersPage {
    rows: MsGroupMemberRow[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MemberCheckInput {
    emails: string[];
    employeeRefs: number[];
    customerRefs: number[];
}

export interface MemberCheckResult {
    emailsTaken: string[];
    refsTaken: string[];
}

function readMembersFilterCount(body: unknown, fallback: number): number {
    if (typeof body === "object" && body !== null && "meta" in body) {
        const meta = (body as { meta?: { filter_count?: unknown; total_count?: unknown } }).meta;
        const count = meta?.filter_count ?? meta?.total_count;
        if (typeof count === "number" && Number.isInteger(count) && count >= 0) return count;
    }
    return fallback;
}

export async function listMembersPage(groupId: number, input: MembersPageInput): Promise<MembersPage> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
    const limit =
        Number.isInteger(input.limit) && input.limit > 0
            ? Math.min(input.limit, MEMBERS_PAGE_MAX_LIMIT)
            : MEMBERS_PAGE_DEFAULT_LIMIT;
    const sort = MEMBER_SORT_MAP[input.sort] ?? MEMBER_SORT_MAP["added-desc"];
    const body = await dFetch(
        `${MEMBERS}?filter[group_id][_eq]=${groupId}&fields=${MEMBER_FIELDS}&sort=${encodeURIComponent(sort)}&limit=${limit}&page=${page}&meta=total_count,filter_count`
    );
    const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(body);
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list, total: readMembersFilterCount(body, list.length), page, pageSize: limit };
}

export async function checkMembers(groupId: number, input: MemberCheckInput): Promise<MemberCheckResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const entry of input.emails) {
        if (typeof entry !== "string") continue;
        const email = normalizeEmail(entry);
        if (email === "" || seen.has(email)) continue;
        seen.add(email);
        emails.push(email);
        if (emails.length >= MEMBER_CHECK_MAX_EACH) break;
    }
    const employeeRefs = Array.from(
        new Set(input.employeeRefs.filter((ref) => Number.isInteger(ref) && ref > 0))
    ).slice(0, MEMBER_CHECK_MAX_EACH);
    const customerRefs = Array.from(
        new Set(input.customerRefs.filter((ref) => Number.isInteger(ref) && ref > 0))
    ).slice(0, MEMBER_CHECK_MAX_EACH);
    if (emails.length === 0 && employeeRefs.length === 0 && customerRefs.length === 0) {
        return { emailsTaken: [], refsTaken: [] };
    }
    const takenEmails = new Set<string>();
    const takenRefs = new Set<string>();
    if (emails.length > 0) {
        const filter = emails.map((email) => encodeURIComponent(email)).join(",");
        const body = await dFetch(
            `${MEMBERS}?filter[group_id][_eq]=${groupId}&filter[email][_in]=${filter}&fields=email,source_kind,source_ref&limit=${emails.length}`
        );
        const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(body);
        if (Array.isArray(rows)) {
            for (const row of rows) {
                takenEmails.add(normalizeEmail(row.email));
                if (row.source_ref !== null && row.source_ref !== undefined) {
                    takenRefs.add(`${row.source_kind}:${row.source_ref}`);
                }
            }
        }
    }
    const refGroups: Array<{ kind: string; refs: number[] }> = [
        { kind: "employee", refs: employeeRefs },
        { kind: "customer", refs: customerRefs },
    ];
    for (const entry of refGroups) {
        if (entry.refs.length === 0) continue;
        const filter = entry.refs.join(",");
        const body = await dFetch(
            `${MEMBERS}?filter[group_id][_eq]=${groupId}&filter[source_kind][_eq]=${entry.kind}&filter[source_ref][_in]=${filter}&fields=email,source_kind,source_ref&limit=${entry.refs.length}`
        );
        const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(body);
        if (Array.isArray(rows)) {
            for (const row of rows) {
                takenEmails.add(normalizeEmail(row.email));
                if (row.source_ref !== null && row.source_ref !== undefined) {
                    takenRefs.add(`${row.source_kind}:${row.source_ref}`);
                }
            }
        }
    }
    return { emailsTaken: Array.from(takenEmails), refsTaken: Array.from(takenRefs) };
}

export async function addMembers(
    groupId: number,
    entries: AddMemberInput[],
    actor: string | null
): Promise<AddMembersResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const existing = await readMemberRows(groupId);
    const taken = new Set(existing.map((row) => normalizeEmail(row.email)));
    const seen = new Set<string>();
    const added: MsGroupMemberRow[] = [];
    const skipped: string[] = [];
    const pending: Array<{ email: string; payload: Record<string, unknown> }> = [];
    for (const entry of entries) {
        const email = normalizeEmail(entry.email);
        if (email === "") {
            throw new GroupValidationError("Member email is required");
        }
        if (seen.has(email) || taken.has(email)) {
            skipped.push(email);
            continue;
        }
        seen.add(email);
        if (entry.source_kind === "manual") {
            if (entry.source_ref !== undefined && entry.source_ref !== null) {
                throw new GroupValidationError("Manual members must not carry a source_ref");
            }
        } else if (entry.source_kind === "customer" || entry.source_kind === "employee") {
            if (entry.source_ref === undefined || entry.source_ref === null) {
                throw new GroupValidationError("Sourced members must carry the source customer or user id");
            }
        } else {
            throw new GroupValidationError(`Unknown source_kind "${entry.source_kind}"`);
        }
        pending.push({
            email,
            payload: stampCreate(
                {
                    ...creationTimestamps(),
                    group_id: groupId,
                    email,
                    source_kind: entry.source_kind,
                    source_ref: entry.source_ref ?? null,
                    is_active: true,
                },
                actor
            ),
        });
    }
    for (let offset = 0; offset < pending.length; offset += INSERT_BATCH_SIZE) {
        const chunk = pending.slice(offset, offset + INSERT_BATCH_SIZE);
        const payloads = chunk.map((item) => item.payload);
        try {
            const body = await dFetch(MEMBERS, { method: "POST", body: JSON.stringify(payloads) });
            throwIfDirectusErrors(body, "Failed to add group member");
            const rows = unwrapStudioGroupsData<MsGroupMemberRow[] | MsGroupMemberRow>(body);
            const list = Array.isArray(rows) ? rows : [rows];
            for (const row of list) {
                added.push(row);
                taken.add(normalizeEmail(row.email));
            }
        } catch (error) {
            if (!(error instanceof GroupConflictError)) {
                throw error;
            }
            for (const item of chunk) {
                if (taken.has(item.email)) {
                    skipped.push(item.email);
                    continue;
                }
                try {
                    const body = await dFetch(MEMBERS, { method: "POST", body: JSON.stringify(item.payload) });
                    throwIfDirectusErrors(body, "Failed to add group member");
                    const row = unwrapStudioGroupsData<MsGroupMemberRow>(body);
                    added.push(row);
                    taken.add(item.email);
                } catch (rowError) {
                    if (rowError instanceof GroupConflictError) {
                        skipped.push(item.email);
                        taken.add(item.email);
                        continue;
                    }
                    throw rowError;
                }
            }
        }
    }
    return { added, skipped };
}

export interface SelectAllMembersInput {
    sourceKind: "employee" | "customer";
    query: string;
}

export interface SelectAllMembersResult extends AddMembersResult {
    scanned: number;
}

export const SELECT_ALL_MAX_ROWS = 5000;

export async function selectAllMembers(
    groupId: number,
    input: SelectAllMembersInput,
    actor: string | null
): Promise<SelectAllMembersResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const candidates =
        input.sourceKind === "employee"
            ? await collectAllEmployeeCandidates(input.query)
            : await collectAllCustomerCandidates(input.query);
    const entries: AddMemberInput[] = [];
    const unusable: string[] = [];
    for (const candidate of candidates) {
        if (candidate.email === null) {
            unusable.push(`${input.sourceKind}:${candidate.ref}`);
            continue;
        }
        entries.push({ email: candidate.email, source_kind: input.sourceKind, source_ref: candidate.ref });
    }
    if (entries.length > SELECT_ALL_MAX_ROWS) {
        throw new GroupValidationError(
            `Matching set too large (${entries.length} mailable). Refine the search — bulk add accepts at most ${SELECT_ALL_MAX_ROWS} per run.`
        );
    }
    const result = await addMembers(groupId, entries, actor);
    return { added: result.added, skipped: [...unusable, ...result.skipped], scanned: candidates.length };
}

export async function removeMember(groupId: number, memberId: number): Promise<void> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const body = await dFetch(
        `${MEMBERS}?filter[id][_eq]=${memberId}&filter[group_id][_eq]=${groupId}&fields=id&limit=1`
    );
    const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(body);
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new GroupNotFoundError("Group member not found");
    }
    await dFetch(`${MEMBERS}/${memberId}`, { method: "DELETE" });
}

export interface RemoveMembersResult {
    removed: number[];
    notFound: number[];
}

export interface MemberFilterInput {
    search: string;
}

async function deleteExplicitMemberIds(groupId: number, memberIds: number[]): Promise<RemoveMembersResult> {
    const seen = new Set<number>();
    const requested: number[] = [];
    for (const value of memberIds) {
        if (!Number.isInteger(value) || value <= 0 || seen.has(value)) continue;
        seen.add(value);
        requested.push(value);
    }
    const existing = new Set(await readMemberIds(groupId));
    const removable = requested.filter((id) => existing.has(id));
    const notFound = requested.filter((id) => !existing.has(id));
    const removed: number[] = [];
    for (let offset = 0; offset < removable.length; offset += DELETE_BATCH_SIZE) {
        const batch = removable.slice(offset, offset + DELETE_BATCH_SIZE);
        const body = await dFetch(MEMBERS, { method: "DELETE", body: JSON.stringify(batch) });
        throwIfDirectusErrors(body, "Failed to remove group members");
        removed.push(...batch);
    }
    return { removed, notFound };
}

async function resolveMemberIdsByFilter(groupId: number, filter: MemberFilterInput): Promise<number[]> {
    const search = filter.search.trim();
    const searchClause = search === "" ? "" : `&filter[email][_icontains]=${encodeURIComponent(search)}`;
    const body = await dFetch(
        `${MEMBERS}?filter[group_id][_eq]=${groupId}${searchClause}&fields=id&sort=id&limit=${BULK_DELETE_MAX_IDS + 1}`
    );
    const rows = unwrapStudioGroupsData<Array<{ id?: unknown }>>(body);
    if (!Array.isArray(rows)) return [];
    const ids: number[] = [];
    for (const row of rows) {
        if (typeof row.id === "number" && Number.isInteger(row.id)) ids.push(row.id);
    }
    return ids;
}

export async function removeMembers(groupId: number, memberIds: number[]): Promise<RemoveMembersResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const hasPositive = memberIds.some((value) => Number.isInteger(value) && value > 0);
    if (!hasPositive) {
        throw new GroupValidationError("At least one member id is required");
    }
    return deleteExplicitMemberIds(groupId, memberIds);
}

export async function removeMembersByFilter(
    groupId: number,
    filter: MemberFilterInput
): Promise<RemoveMembersResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const ids = await resolveMemberIdsByFilter(groupId, filter);
    if (ids.length > BULK_DELETE_MAX_IDS) {
        throw new GroupValidationError(
            `Matching set too large (${ids.length}). Bulk delete accepts at most ${BULK_DELETE_MAX_IDS} per run — narrow the filter.`
        );
    }
    if (ids.length === 0) {
        return { removed: [], notFound: [] };
    }
    return deleteExplicitMemberIds(groupId, ids);
}

export async function setMemberActive(
    groupId: number,
    memberId: number,
    isActive: boolean,
    actor: string | null
): Promise<MsGroupMemberRow> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const lookup = await dFetch(
        `${MEMBERS}?filter[id][_eq]=${memberId}&filter[group_id][_eq]=${groupId}&fields=id&limit=1`
    );
    const rows = unwrapStudioGroupsData<MsGroupMemberRow[]>(lookup);
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new GroupNotFoundError("Group member not found");
    }
    const body = await dFetch(
        `${MEMBERS}/${memberId}`,
        {
            method: "PATCH",
            body: JSON.stringify(stampUpdate({ is_active: isActive, updated_at: nowUTC() }, actor)),
        }
    );
    throwIfDirectusErrors(body, "Failed to update group member");
    return unwrapStudioGroupsData<MsGroupMemberRow>(body);
}

export async function resyncGroup(groupId: number, actor: string | null): Promise<ResyncResult> {
    const group = await readGroupRow(groupId);
    if (!group) {
        throw new GroupNotFoundError("Group not found");
    }
    const members = await readMemberRows(groupId);
    const companyDomains = await readCompanyDomains();
    let updated = 0;
    let unchanged = 0;
    let missing = 0;
    for (const member of members) {
        if (member.source_ref === null || member.source_ref === undefined) {
            continue;
        }
        const current =
            member.source_kind === "customer"
                ? await readCustomerEmail(member.source_ref)
                : member.source_kind === "employee"
                  ? await readEmployeeEmail(member.source_ref, companyDomains)
                  : null;
        if (current === null) {
            missing += 1;
            continue;
        }
        if (current === normalizeEmail(member.email)) {
            unchanged += 1;
            continue;
        }
        try {
            const body = await dFetch(
                `${MEMBERS}/${member.id}`,
                {
                    method: "PATCH",
                    body: JSON.stringify(stampUpdate({ email: current, updated_at: nowUTC() }, actor)),
                }
            );
            throwIfDirectusErrors(body, "Failed to re-sync group member");
            updated += 1;
        } catch (error) {
            if (error instanceof GroupConflictError) {
                await dFetch(`${MEMBERS}/${member.id}`, { method: "DELETE" });
                updated += 1;
                continue;
            }
            throw error;
        }
    }
    return { updated, unchanged, missing };
}
