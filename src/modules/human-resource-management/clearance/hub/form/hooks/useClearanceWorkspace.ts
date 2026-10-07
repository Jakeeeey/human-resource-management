"use client";

import { useCallback, useEffect, useState } from "react";

import type { ClearanceFormRenderModel } from "../types";

export const CLEARANCE_REQUEST_STATUSES = ["pending", "in_progress", "completed"] as const;

export type ClearanceRequestStatus = (typeof CLEARANCE_REQUEST_STATUSES)[number];

export interface ClearanceSigningItem {
    id: number;
    request_id: number;
    label_snapshot: string;
    instructions_snapshot: string | null;
    signer_type_snapshot: string;
    department_id_snapshot: number | null;
    department_name_snapshot: string | null;
    sort_order: number;
    status: string;
    signatory_id: number | null;
    remarks: string | null;
}

export interface ClearanceSigningRequest {
    id: number;
    resignation_id: number;
    user_id: number;
    template_id: number;
    template_title_snapshot: string | null;
    status: ClearanceRequestStatus;
    confirmed_by: number | null;
    confirmed_at: string | null;
    created_at: string | null;
    items: ClearanceSigningItem[];
    signed_count: number;
    total_count: number;
    cleared: boolean;
}

const REQUESTS_API = "/api/hrm/clearance/requests";

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

function toRequestStatus(value: unknown): ClearanceRequestStatus | null {
    if (typeof value !== "string") return null;
    return (CLEARANCE_REQUEST_STATUSES as readonly string[]).includes(value)
        ? (value as ClearanceRequestStatus)
        : null;
}

function parseDetailItem(value: unknown): ClearanceSigningItem | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const requestId = toId(value.request_id);
    const label = toNullableText(value.label_snapshot);
    if (id === null || requestId === null || label === null) return null;
    return {
        id,
        request_id: requestId,
        label_snapshot: label,
        instructions_snapshot: toNullableText(value.instructions_snapshot),
        signer_type_snapshot: typeof value.signer_type_snapshot === "string" ? value.signer_type_snapshot : "",
        department_id_snapshot: toNullableId(value.department_id_snapshot),
        department_name_snapshot: toNullableText(value.department_name_snapshot),
        sort_order: toId(value.sort_order) ?? 0,
        status: typeof value.status === "string" ? value.status : "pending",
        signatory_id: toNullableId(value.signatory_id),
        remarks: toNullableText(value.remarks),
    };
}

function parseDetailRequest(value: unknown): ClearanceSigningRequest | null {
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
        .map(parseDetailItem)
        .filter((item): item is ClearanceSigningItem => item !== null)
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

async function fetchDetailRequest(id: number): Promise<ClearanceSigningRequest> {
    const response = await fetch(`${REQUESTS_API}/${id}`, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load clearance request"));
    }
    const payload = (await response.json()) as { data?: unknown };
    const parsed = parseDetailRequest(payload.data);
    if (!parsed) throw new Error("Failed to load clearance request");
    return parsed;
}

async function fetchEmployeeName(requestId: number): Promise<string | null> {
    const response = await fetch(`/api/hrm/clearance/form/render-model?request_id=${requestId}`, {
        cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null;
    const name = (body.data as Partial<ClearanceFormRenderModel>).employeeName;
    return typeof name === "string" && name.trim() !== "" ? name : null;
}

export function useClearanceWorkspace(requestId: number, nameFallback: string | null) {
    const [detail, setDetail] = useState<ClearanceSigningRequest | null>(null);
    const [employeeName, setEmployeeName] = useState<string>(nameFallback ?? "Unknown employee");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(() => {
        setNonce((value) => value + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        (async () => {
            try {
                const loaded = await fetchDetailRequest(requestId);
                if (cancelled) return;
                setDetail(loaded);
                if (nameFallback !== null && nameFallback.trim() !== "") {
                    setEmployeeName(nameFallback);
                } else {
                    const resolved = await fetchEmployeeName(requestId);
                    if (!cancelled) setEmployeeName(resolved ?? "Unknown employee");
                }
            } catch (err) {
                if (cancelled) return;
                setDetail(null);
                setEmployeeName(nameFallback ?? "Unknown employee");
                setError(err instanceof Error ? err.message : "Failed to load clearance request");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, nonce, nameFallback]);

    return {
        detail,
        employeeName,
        isLoading,
        error,
        refresh,
    };
}
