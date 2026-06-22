"use client";

import { LogisticsPayrollDataResponse, ApprovePayrollPayload } from "../types/logistics-payroll.schema";

const API_BASE = "/api/hrm/payroll/logistics-payroll";

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

export async function fetchLogisticsPayroll(cutoffStart?: string, cutoffEnd?: string) {
    const searchParams = new URLSearchParams();
    if (cutoffStart) searchParams.set("cutoff_start", cutoffStart);
    if (cutoffEnd) searchParams.set("cutoff_end", cutoffEnd);
    
    const query = searchParams.toString();
    const url = query ? `${API_BASE}?${query}` : API_BASE;
    
    return http<LogisticsPayrollDataResponse>(url);
}

export async function approveLogisticsPayroll(payload: ApprovePayrollPayload) {
    return http<any>(API_BASE, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}
