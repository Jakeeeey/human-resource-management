import type { GroupSourceKind, MemberSort, MsGroupMemberRow, MsGroupRow } from "../types";

export interface MsGroupResyncResult {
    updated: number;
    unchanged: number;
    missing: number;
}

export interface MsGroupMembersPage {
    rows: MsGroupMemberRow[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MsAddGroupMembersResult {
    added: MsGroupMemberRow[];
    skipped: string[];
    message: string | null;
}

export interface MsDeleteGroupOutcome {
    group: MsGroupRow;
    message: string;
}

export interface MsGroupCreateInput {
    group_key: string;
    group_name: string;
    description?: string | null;
    is_active?: boolean;
}

export interface MsGroupPatchInput {
    group_name?: string;
    description?: string | null;
    is_active?: boolean;
}

export interface MsNewGroupMember {
    email: string;
    source_kind: GroupSourceKind;
    source_ref?: number | null;
}

export interface MsEmployeeOption {
    ref: number;
    name: string;
    email: string | null;
    selectable: boolean;
    reason: string | null;
}

export interface MsCustomerOption {
    ref: number;
    name: string;
    subtitle: string | null;
    email: string | null;
    active: boolean;
    selectable: boolean;
    reason: string | null;
}

export interface MsDirectoryPage<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export interface MsDirectoryQuery {
    search: string;
    page: number;
    limit?: number;
}

interface MsEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

async function readEnvelope<T>(res: Response): Promise<MsEnvelope<T>> {
    try {
        return (await res.json()) as MsEnvelope<T>;
    } catch {
        return { success: false };
    }
}

function fieldDetails(errors: Record<string, string[]> | undefined): string | null {
    if (!errors) return null;
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(errors)) {
        if (messages.length > 0) parts.push(`${field}: ${messages.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : null;
}

function failureMessage(envelope: MsEnvelope<unknown>, res: Response): string {
    const fallback = `Mailing Studio request failed (HTTP ${res.status})`;
    const message = envelope.message ?? fallback;
    const details = fieldDetails(envelope.errors);
    return details ? `${message} — ${details}` : message;
}

async function unwrap<T>(res: Response): Promise<T | undefined> {
    const envelope = await readEnvelope<T>(res);
    if (!res.ok || !envelope || envelope.success !== true) throw new Error(failureMessage(envelope, res));
    return envelope.data;
}

async function unwrapWithMessage<T>(res: Response): Promise<{ data: T | undefined; message: string | null }> {
    const envelope = await readEnvelope<T>(res);
    if (!res.ok || !envelope || envelope.success !== true) throw new Error(failureMessage(envelope, res));
    return { data: envelope.data, message: envelope.message ?? null };
}

export async function fetchMsGroups(isActive?: boolean): Promise<MsGroupRow[]> {
    const qs = isActive === undefined ? "" : `?is_active=${isActive ? "true" : "false"}`;
    const data = await unwrap<MsGroupRow[]>(
        await fetch(`/api/hrm/mailing-studio/groups${qs}`)
    );
    return data ?? [];
}

export async function fetchMsGroup(id: number): Promise<MsGroupRow | null> {
    const data = await unwrap<MsGroupRow>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(id))}`)
    );
    return data ?? null;
}

export async function createMsGroup(input: MsGroupCreateInput): Promise<MsGroupRow> {
    const data = await unwrap<MsGroupRow>(
        await fetch("/api/hrm/mailing-studio/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
        })
    );
    if (!data) throw new Error("Group create returned no data.");
    return data;
}

export async function patchMsGroup(id: number, patch: MsGroupPatchInput): Promise<MsGroupRow> {
    const data = await unwrap<MsGroupRow>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        })
    );
    if (!data) throw new Error("Group update returned no data.");
    return data;
}

export async function deleteMsGroup(id: number): Promise<MsDeleteGroupOutcome> {
    const { data, message } = await unwrapWithMessage<MsGroupRow>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(id))}`, { method: "DELETE" })
    );
    if (!data) throw new Error(message ?? "Group delete returned no data.");
    return { group: data, message: message ?? "Group deleted." };
}

export async function fetchMsGroupMembers(
    groupId: number,
    query?: { page?: number; limit?: number; sort?: MemberSort }
): Promise<MsGroupMembersPage> {
    const params = new URLSearchParams();
    if (query?.page !== undefined) params.set("page", String(query.page));
    if (query?.limit !== undefined) params.set("limit", String(query.limit));
    if (query?.sort !== undefined) params.set("sort", query.sort);
    const qs = params.size > 0 ? `?${params.toString()}` : "";
    const data = await unwrap<MsGroupMembersPage>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members${qs}`)
    );
    return data ?? { rows: [], total: 0, page: query?.page ?? 1, pageSize: query?.limit ?? 25 };
}

export interface MsMemberCheckResult {
    emailsTaken: string[];
    refsTaken: string[];
}

export async function checkMsGroupMembers(
    groupId: number,
    input: { emails?: string[]; employeeRefs?: number[]; customerRefs?: number[] }
): Promise<MsMemberCheckResult> {
    const data = await unwrap<MsMemberCheckResult>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emails: input.emails ?? [],
                employee_refs: input.employeeRefs ?? [],
                customer_refs: input.customerRefs ?? [],
            }),
        })
    );
    return data ?? { emailsTaken: [], refsTaken: [] };
}

export async function addMsGroupMembers(
    groupId: number,
    members: MsNewGroupMember[]
): Promise<MsAddGroupMembersResult> {
    const payload = members.map((member) =>
        member.source_kind === "manual"
            ? { email: member.email, source_kind: member.source_kind }
            : { email: member.email, source_kind: member.source_kind, source_ref: member.source_ref ?? null }
    );
    const { data, message } = await unwrapWithMessage<{ added: MsGroupMemberRow[]; skipped: string[] }>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ members: payload }),
        })
    );
    return { added: data?.added ?? [], skipped: data?.skipped ?? [], message };
}

export interface MsSelectAllMembersInput {
    sourceKind: "employee" | "customer";
    search: string;
}

export async function selectAllMsGroupMembers(
    groupId: number,
    input: MsSelectAllMembersInput
): Promise<MsAddGroupMembersResult> {
    const { data, message } = await unwrapWithMessage<{ added: MsGroupMemberRow[]; skipped: string[] }>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members/select-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_kind: input.sourceKind, search: input.search }),
        })
    );
    return { added: data?.added ?? [], skipped: data?.skipped ?? [], message };
}

export async function removeMsGroupMember(groupId: number, memberId: number): Promise<string | null> {
    const { message } = await unwrapWithMessage<{ id: number }>(
        await fetch(
            `/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members?member_id=${encodeURIComponent(String(memberId))}`,
            { method: "DELETE" }
        )
    );
    return message;
}

export interface MsGroupMemberFilter {
    search?: string;
}

export type MsBulkDeleteTarget = { memberIds: number[] } | { filter: MsGroupMemberFilter };

export interface MsRemoveGroupMembersResult {
    removed: number[];
    notFound: number[];
    message: string | null;
}

export async function bulkRemoveMsGroupMembers(
    groupId: number,
    target: MsBulkDeleteTarget
): Promise<MsRemoveGroupMembersResult> {
    const body = "memberIds" in target ? { member_ids: target.memberIds } : { filter: target.filter };
    const { data, message } = await unwrapWithMessage<{ removed: number[]; notFound: number[] }>(
        await fetch(
            `/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/members/bulk-delete`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }
        )
    );
    return { removed: data?.removed ?? [], notFound: data?.notFound ?? [], message };
}

export async function resyncMsGroup(groupId: number): Promise<MsGroupResyncResult> {
    const data = await unwrap<MsGroupResyncResult>(
        await fetch(`/api/hrm/mailing-studio/groups/${encodeURIComponent(String(groupId))}/resync`, {
            method: "POST",
        })
    );
    if (!data) throw new Error("Group re-sync returned no data.");
    return data;
}

function directoryQueryString(query: MsDirectoryQuery): string {
    const params = new URLSearchParams();
    if (query.search.trim() !== "") params.set("search", query.search.trim());
    params.set("page", String(query.page));
    params.set("limit", String(query.limit ?? 10));
    return params.toString();
}

export async function fetchMsDirectoryEmployees(query: MsDirectoryQuery): Promise<MsDirectoryPage<MsEmployeeOption>> {
    const data = await unwrap<MsDirectoryPage<MsEmployeeOption>>(
        await fetch(`/api/hrm/mailing-studio/groups/employees?${directoryQueryString(query)}`)
    );
    return data ?? { items: [], total: 0, page: query.page, pageSize: query.limit ?? 10 };
}

export async function fetchMsDirectoryCustomers(query: MsDirectoryQuery): Promise<MsDirectoryPage<MsCustomerOption>> {
    const data = await unwrap<MsDirectoryPage<MsCustomerOption>>(
        await fetch(`/api/hrm/mailing-studio/groups/customers?${directoryQueryString(query)}`)
    );
    return data ?? { items: [], total: 0, page: query.page, pageSize: query.limit ?? 10 };
}
