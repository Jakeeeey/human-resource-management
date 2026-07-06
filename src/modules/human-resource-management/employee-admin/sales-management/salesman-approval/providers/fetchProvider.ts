"use client";

import type {
    SalesmanDraftWithRelations,
    User,
    Division,
    Branch,
    Operation,
    PriceType,
} from "../types";

const API_BASE = "/api/hrm/employee-admin/structure/sales-management/salesman-approval";

export interface SalesmanApprovalDataResponse {
    drafts: SalesmanDraftWithRelations[];
    users: User[];
    divisions: Division[];
    branches: Branch[];
    badBranches: Branch[];
    operations: Operation[];
    priceTypes: PriceType[];
}

async function http<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
        ...init,
        headers: {
            ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
            ...(init?.headers ?? {}),
        },
        credentials: "include",
        cache: "no-store",
    });

    const text = await res.text();

    let json: unknown = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        const errorObj = json as { message?: string; error?: string } | null;
        const msg =
            errorObj?.message ||
            errorObj?.error ||
            (typeof json === "string" ? json : "") ||
            text ||
            `Request failed (${res.status})`;
        throw new Error(msg);
    }

    return (json ?? (text as unknown)) as T;
}

export async function getSalesmanApprovalData() {
    return http<SalesmanApprovalDataResponse>(API_BASE);
}

export async function approveSalesmanDraft(id: number, data?: Record<string, unknown>) {
    return http<unknown>(API_BASE, {
        method: "POST",
        body: JSON.stringify({ id, ...(data || {}) }),
    });
}

export async function rejectSalesmanDraft(id: number) {
    const url = `${API_BASE}?id=${encodeURIComponent(String(id))}`;
    return http<unknown>(url, { method: "DELETE" });
}
