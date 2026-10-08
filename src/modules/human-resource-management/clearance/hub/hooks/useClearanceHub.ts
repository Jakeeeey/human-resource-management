"use client";

import { useCallback, useRef, useState } from "react";

import {
    CLEARANCE_REQUEST_STATUSES,
    CLEARANCE_SIGNER_TYPES,
    type ClearanceRequestStatus,
    type ClearanceSignerType,
} from "../types";

export interface ClearanceHubItem {
    id: number;
    request_id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    signer_type_snapshot: ClearanceSignerType;
    department_id_snapshot: number | null;
    department_name_snapshot: string | null;
    sort_order: number;
    status: string;
    signatory_id: number | null;
    remarks: string | null;
}

export interface ClearanceHubRequest {
    id: number;
    resignation_id: number;
    user_id: number;
    template_id: number;
    template_title_snapshot: string | null;
    status: ClearanceRequestStatus;
    confirmed_by: number | null;
    confirmed_at: string | null;
    created_at: string | null;
    items: ClearanceHubItem[];
    signed_count: number;
    total_count: number;
    cleared: boolean;
}

export interface ClearanceHubTemplate {
    id: number;
    code: string;
    title: string;
    description: string | null;
    department_id: number | null;
    is_active: boolean;
    sort_order: number;
}

export interface ClearanceHubSoaTemplate {
    id: number;
    code: string;
    title: string;
    description: string | null;
    department_id: number | null;
    is_active: boolean;
    sort_order: number;
}

export interface ApprovableResignation {
    id: number;
    user_id: number;
    employee_name: string;
    department_id: number | null;
    department_name: string | null;
    filed_at: string | null;
    resignation_date: string | null;
    has_clearance: boolean;
}

export interface ClearanceHubCounts {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
}

export interface ClearanceHubCandidate {
    user_id: number;
    full_name: string;
    is_department_head: boolean;
}

export interface UpdateClearanceItemInput {
    label?: string;
    signer_type?: ClearanceSignerType;
    department_id?: number | null;
}

const REQUESTS_API = "/api/hrm/clearance/requests";
const TEMPLATES_API = "/api/hrm/clearance/templates";
const SOA_TEMPLATES_API = "/api/hrm/clearance/soa-templates";
const APPROVED_RESIGNATIONS_API = "/api/hrm/clearance/approved-resignations";
const ITEMS_API = "/api/hrm/clearance/items";
const SIGNATORIES_API = "/api/hrm/clearance/signatories";

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

function toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function toRequestStatus(value: unknown): ClearanceRequestStatus | null {
    if (typeof value !== "string") return null;
    return (CLEARANCE_REQUEST_STATUSES as readonly string[]).includes(value)
        ? (value as ClearanceRequestStatus)
        : null;
}

function toSignerType(value: unknown): ClearanceSignerType | null {
    if (typeof value !== "string") return null;
    return (CLEARANCE_SIGNER_TYPES as readonly string[]).includes(value)
        ? (value as ClearanceSignerType)
        : null;
}

function parseHubItem(value: unknown): ClearanceHubItem | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const requestId = toId(value.request_id);
    const label = toNullableText(value.label_snapshot);
    const signerType = toSignerType(value.signer_type_snapshot);
    if (id === null || requestId === null || label === null || signerType === null) return null;
    return {
        id,
        request_id: requestId,
        label_snapshot: label,
        instructions_snapshot: toNullableText(value.instructions_snapshot),
        signer_type_snapshot: signerType,
        department_id_snapshot: toNullableId(value.department_id_snapshot),
        department_name_snapshot: toNullableText(value.department_name_snapshot),
        sort_order: toId(value.sort_order) ?? 0,
        status: typeof value.status === "string" ? value.status : "pending",
        signatory_id: toNullableId(value.signatory_id),
        remarks: toNullableText(value.remarks),
    };
}

function parseHubRequest(value: unknown): ClearanceHubRequest | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const resignationId = toId(value.resignation_id);
    const userId = toId(value.user_id);
    const templateId = toId(value.template_id);
    const status = toRequestStatus(value.status);
    if (id === null || resignationId === null || userId === null || templateId === null || status === null) {
        return null;
    }
    const rawItems = Array.isArray(value.items) ? value.items : [];
    const items = rawItems
        .map(parseHubItem)
        .filter((item): item is ClearanceHubItem => item !== null)
        .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
    const signedCount = toId(value.signed_count) ?? items.filter((item) => item.status === "signed").length;
    const totalCount = toId(value.total_count) ?? items.length;
    return {
        id,
        resignation_id: resignationId,
        user_id: userId,
        template_id: templateId,
        template_title_snapshot: toNullableText(value.template_title_snapshot),
        status,
        confirmed_by: toNullableId(value.confirmed_by),
        confirmed_at: toNullableText(value.confirmed_at),
        created_at: toNullableText(value.created_at),
        items,
        signed_count: signedCount,
        total_count: totalCount,
        cleared: typeof value.cleared === "boolean" ? value.cleared : status === "completed",
    };
}

function parseHubCounts(value: unknown, rows: ClearanceHubRequest[]): ClearanceHubCounts {
    const fallback: ClearanceHubCounts = { total: rows.length, pending: 0, in_progress: 0, completed: 0 };
    for (const row of rows) {
        if (row.status === "pending") fallback.pending += 1;
        else if (row.status === "in_progress") fallback.in_progress += 1;
        else if (row.status === "completed") fallback.completed += 1;
    }
    if (!isRecord(value)) return fallback;
    const total = toId(value.total);
    const pending = toId(value.pending);
    const inProgress = toId(value.in_progress);
    const completed = toId(value.completed);
    if (total === null || pending === null || inProgress === null || completed === null) return fallback;
    return { total, pending, in_progress: inProgress, completed };
}

function parseHubTemplate(value: unknown): ClearanceHubTemplate | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const code = toNullableText(value.code);
    const title = toNullableText(value.title);
    if (id === null || code === null || title === null) return null;
    return {
        id,
        code,
        title,
        description: toNullableText(value.description),
        department_id: toNullableId(value.department_id),
        is_active: toBoolean(value.is_active),
        sort_order: toId(value.sort_order) ?? 0,
    };
}

function parseHubSoaTemplate(value: unknown): ClearanceHubSoaTemplate | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const code = toNullableText(value.code);
    const title = toNullableText(value.title);
    if (id === null || code === null || title === null) return null;
    return {
        id,
        code,
        title,
        description: toNullableText(value.description),
        department_id: toNullableId(value.department_id),
        is_active: toBoolean(value.is_active),
        sort_order: toId(value.sort_order) ?? 0,
    };
}

function parseApprovableResignation(value: unknown): ApprovableResignation | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const userId = toId(value.user_id);
    const employeeName = toNullableText(value.employee_name);
    if (id === null || userId === null || employeeName === null) return null;
    return {
        id,
        user_id: userId,
        employee_name: employeeName,
        department_id: toNullableId(value.department_id),
        department_name: toNullableText(value.department_name),
        filed_at: toNullableText(value.filed_at),
        resignation_date: toNullableText(value.resignation_date),
        has_clearance: value.has_clearance === true,
    };
}

function parseHubCandidate(value: unknown): ClearanceHubCandidate | null {
    if (!isRecord(value)) return null;
    const userId = toId(value.user_id);
    const fullName = toNullableText(value.full_name);
    if (userId === null || fullName === null) return null;
    return { user_id: userId, full_name: fullName, is_department_head: value.is_department_head === true };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    const payload = (await response.json().catch(() => null)) as {
        message?: unknown;
        error?: unknown;
    } | null;
    if (typeof payload?.message === "string" && payload.message.trim() !== "") return payload.message;
    if (typeof payload?.error === "string" && payload.error.trim() !== "") return payload.error;
    return fallback;
}

export interface ClearanceHubListQuery {
    page?: number;
    limit?: number;
    sort?: string;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

const DEFAULT_LIST_PAGE = 1;
const DEFAULT_LIST_LIMIT = 10;

const DEFAULT_LIST_QUERY: ClearanceHubListQuery = { page: DEFAULT_LIST_PAGE, limit: DEFAULT_LIST_LIMIT };

function toListSearchParams(query: ClearanceHubListQuery): string {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? DEFAULT_LIST_PAGE));
    params.set("limit", String(query.limit ?? DEFAULT_LIST_LIMIT));
    if (query.sort !== undefined && query.sort !== "") params.set("sort", query.sort);
    if (query.search !== undefined && query.search !== "") params.set("search", query.search);
    if (query.status !== undefined && query.status !== "") params.set("status", query.status);
    if (query.dateFrom !== undefined && query.dateFrom !== "") params.set("date_from", query.dateFrom);
    if (query.dateTo !== undefined && query.dateTo !== "") params.set("date_to", query.dateTo);
    const encoded = params.toString();
    return encoded === "" ? "" : `?${encoded}`;
}

export function useClearanceHub() {
    const [requests, setRequests] = useState<ClearanceHubRequest[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [counts, setCounts] = useState<ClearanceHubCounts>({ total: 0, pending: 0, in_progress: 0, completed: 0 });
    const [templates, setTemplates] = useState<ClearanceHubTemplate[]>([]);
    const [templatesError, setTemplatesError] = useState<string | null>(null);
    const [soaTemplates, setSoaTemplates] = useState<ClearanceHubSoaTemplate[]>([]);
    const [soaTemplatesError, setSoaTemplatesError] = useState<string | null>(null);
    const [resignations, setResignations] = useState<ApprovableResignation[]>([]);
    const [resignationsError, setResignationsError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const lastQuery = useRef<ClearanceHubListQuery>({ ...DEFAULT_LIST_QUERY });

    const loadLookups = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch(TEMPLATES_API, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load clearance templates"));
            }
            const payload = (await response.json()) as { data?: unknown };
            const rows = Array.isArray(payload.data) ? payload.data : [];
            setTemplates(
                rows
                    .map(parseHubTemplate)
                    .filter((row): row is ClearanceHubTemplate => row !== null)
                    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
            );
            setTemplatesError(null);
        } catch (err) {
            setTemplates([]);
            setTemplatesError(err instanceof Error ? err.message : "Failed to load clearance templates");
        }
        try {
            const response = await fetch(SOA_TEMPLATES_API, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load SOA templates"));
            }
            const payload = (await response.json()) as { data?: unknown };
            const rows = Array.isArray(payload.data) ? payload.data : [];
            setSoaTemplates(
                rows
                    .map(parseHubSoaTemplate)
                    .filter((row): row is ClearanceHubSoaTemplate => row !== null)
                    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
            );
            setSoaTemplatesError(null);
        } catch (err) {
            setSoaTemplates([]);
            setSoaTemplatesError(err instanceof Error ? err.message : "Failed to load SOA templates");
        }
        try {
            const response = await fetch(APPROVED_RESIGNATIONS_API, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to load approved resignations"));
            }
            const payload = (await response.json()) as { data?: unknown };
            const rows = Array.isArray(payload.data) ? payload.data : [];
            setResignations(
                rows
                    .map(parseApprovableResignation)
                    .filter((row): row is ApprovableResignation => row !== null)
            );
            setResignationsError(null);
        } catch (err) {
            setResignations([]);
            setResignationsError(err instanceof Error ? err.message : "Failed to load approved resignations");
        }
    }, []);

    const refreshLookups = useCallback(async (): Promise<void> => {
        setIsLoading(true);
        try {
            await loadLookups();
        } finally {
            setIsLoading(false);
        }
    }, [loadLookups]);

    const refresh = useCallback(async (query?: ClearanceHubListQuery): Promise<void> => {
        const effective = query ?? lastQuery.current;
        if (query !== undefined) lastQuery.current = query;
        setIsLoading(true);
        setError(null);
        try {
            try {
                const response = await fetch(`${REQUESTS_API}${toListSearchParams(effective)}`, { cache: "no-store" });
                if (!response.ok) {
                    throw new Error(await readErrorMessage(response, "Failed to load clearance requests"));
                }
                const payload = (await response.json()) as { data?: unknown; counts?: unknown; total?: unknown };
                const rows = Array.isArray(payload.data) ? payload.data : [];
                const parsed = rows
                    .map(parseHubRequest)
                    .filter((row): row is ClearanceHubRequest => row !== null);
                setRequests(parsed);
                setTotal(typeof payload.total === "number" && Number.isInteger(payload.total) ? payload.total : parsed.length);
                setCounts(parseHubCounts(payload.counts, parsed));
            } catch (err) {
                setRequests([]);
                setTotal(0);
                setCounts({ total: 0, pending: 0, in_progress: 0, completed: 0 });
                setError(err instanceof Error ? err.message : "Failed to load clearance requests");
            }
            await loadLookups();
        } finally {
            setIsLoading(false);
        }
    }, [loadLookups]);

    const assignClearance = useCallback(
        async (resignationId: number, templateId: number, soaTemplateId?: number | null): Promise<string> => {
            const body: Record<string, unknown> = { resignation_id: resignationId, template_id: templateId };
            if (soaTemplateId !== undefined && soaTemplateId !== null) {
                body.soa_template_id = soaTemplateId;
            }
            const response = await fetch(REQUESTS_API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to assign clearance"));
            }
            await refresh();
            return response.status === 200
                ? "A clearance is already on file for this resignation"
                : "Clearance assigned";
        },
        [refresh]
    );

    const fetchDetail = useCallback(async (id: number): Promise<ClearanceHubRequest> => {
        const response = await fetch(`${REQUESTS_API}/${id}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, "Failed to load clearance request"));
        }
        const payload = (await response.json()) as { data?: unknown };
        const parsed = parseHubRequest(payload.data);
        if (!parsed) throw new Error("Failed to load clearance request");
        return parsed;
    }, []);

    const fetchCandidates = useCallback(async (itemId: number): Promise<ClearanceHubCandidate[]> => {
        const response = await fetch(`${SIGNATORIES_API}?item_id=${itemId}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(await readErrorMessage(response, "Failed to load signatories"));
        }
        const payload = (await response.json()) as { data?: unknown };
        const rows = Array.isArray(payload.data) ? payload.data : [];
        return rows
            .map(parseHubCandidate)
            .filter((row): row is ClearanceHubCandidate => row !== null);
    }, []);

    const confirmRequest = useCallback(
        async (id: number): Promise<ClearanceHubRequest> => {
            const response = await fetch(`${REQUESTS_API}/${id}/confirm`, { method: "POST" });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to confirm clearance"));
            }
            const payload = (await response.json()) as { data?: unknown };
            const parsed = parseHubRequest(payload.data);
            if (!parsed) throw new Error("Failed to confirm clearance");
            await refresh();
            return parsed;
        },
        [refresh]
    );

    const updateItem = useCallback(
        async (id: number, input: UpdateClearanceItemInput): Promise<void> => {
            const body: Record<string, unknown> = {};
            if (input.label !== undefined) body.label = input.label;
            if (input.signer_type !== undefined) body.signer_type = input.signer_type;
            if (input.department_id !== undefined) body.department_id = input.department_id;
            const response = await fetch(`${ITEMS_API}/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to update clearance item"));
            }
            await refresh();
        },
        [refresh]
    );

    const replacePool = useCallback(
        async (requestId: number, itemId: number, userIds: number[]): Promise<void> => {
            const response = await fetch(`${REQUESTS_API}/${requestId}/items/${itemId}/signatories`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_ids: userIds }),
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Failed to replace signatories"));
            }
            await refresh();
        },
        [refresh]
    );

    return {
        requests,
        total,
        counts,
        templates,
        templatesError,
        soaTemplates,
        soaTemplatesError,
        resignations,
        resignationsError,
        isLoading,
        error,
        refresh,
        refreshLookups,
        assignClearance,
        fetchDetail,
        fetchCandidates,
        confirmRequest,
        updateItem,
        replacePool,
    };
}
