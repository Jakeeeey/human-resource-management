"use client";

import { useCallback, useEffect, useState } from "react";

const FORM_API = "/api/hrm/clearance/form";
const SOA_API = "/api/hrm/clearance/soa";
const QUIT_CLAIMS_API = "/api/hrm/clearance/quit-claims";
const PAGE_LIMIT = 100;

export type FormDocumentKey = "form" | "soa" | "quit_claim";

export type FormDocumentState = "missing" | "pending" | "approved";

export interface FormDocumentEntry {
    key: FormDocumentKey;
    state: FormDocumentState;
    refNo: string | null;
}

export interface FormDocumentChecklist {
    requestId: number;
    form: FormDocumentEntry;
    soa: FormDocumentEntry;
    quitClaim: FormDocumentEntry;
    approvedCount: number;
    complete: boolean;
}

export type FormDocumentSnapshot = Pick<FormDocumentEntry, "state" | "refNo">;

interface DocumentRow {
    requestId: number | null;
    state: FormDocumentState;
    refNo: string | null;
}

const MISSING_DOCUMENT_SNAPSHOT: FormDocumentSnapshot = { state: "missing", refNo: null };

function toFormDocumentChecklist(
    requestId: number,
    form?: FormDocumentSnapshot,
    soa?: FormDocumentSnapshot,
    quitClaim?: FormDocumentSnapshot
): FormDocumentChecklist {
    const resolvedForm = form ?? MISSING_DOCUMENT_SNAPSHOT;
    const resolvedSoa = soa ?? MISSING_DOCUMENT_SNAPSHOT;
    const resolvedQuitClaim = quitClaim ?? MISSING_DOCUMENT_SNAPSHOT;
    const approvedCount = [resolvedForm, resolvedSoa, resolvedQuitClaim].filter(
        (entry) => entry.state === "approved"
    ).length;
    return {
        requestId,
        form: { key: "form", state: resolvedForm.state, refNo: resolvedForm.refNo },
        soa: { key: "soa", state: resolvedSoa.state, refNo: resolvedSoa.refNo },
        quitClaim: { key: "quit_claim", state: resolvedQuitClaim.state, refNo: resolvedQuitClaim.refNo },
        approvedCount,
        complete: approvedCount === 3,
    };
}

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

function toDocumentState(value: unknown): FormDocumentState | null {
    if (value === "approved") return "approved";
    if (value === "pending") return "pending";
    return null;
}

function parseDocumentRow(value: unknown): DocumentRow | null {
    if (!isRecord(value)) return null;
    const state = toDocumentState(value.status);
    if (state === null) return null;
    return {
        requestId: toNullableId(value.request_id),
        state,
        refNo: toNullableText(value.ref_no),
    };
}

function toSnapshot(row: DocumentRow | null): FormDocumentSnapshot | undefined {
    if (!row) return undefined;
    return { state: row.state, refNo: row.refNo };
}

function preferApproved(current: DocumentRow | null, next: DocumentRow): DocumentRow {
    if (!current) return next;
    if (current.state !== "approved" && next.state === "approved") return next;
    return current;
}

async function fetchDocumentRows(base: string, extraQuery: string): Promise<DocumentRow[]> {
    const rows: DocumentRow[] = [];
    const prefix = extraQuery === "" ? "" : `${extraQuery}&`;
    let page = 1;
    let finished = false;
    while (!finished) {
        const response = await fetch(`${base}?${prefix}page=${page}&limit=${PAGE_LIMIT}`, {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("Failed to load document statuses");
        }
        const payload: unknown = await response.json().catch(() => null);
        if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) {
            throw new Error("Failed to load document statuses");
        }
        const batch: DocumentRow[] = [];
        for (const entry of payload.data) {
            const row = parseDocumentRow(entry);
            if (row) batch.push(row);
        }
        rows.push(...batch);
        const reportedTotal = toId(payload.total);
        if (reportedTotal !== null) {
            finished = rows.length >= reportedTotal;
        } else {
            finished = batch.length < PAGE_LIMIT;
        }
        if (batch.length === 0) {
            finished = true;
        }
        page += 1;
    }
    return rows;
}

async function fetchByRequest(base: string, requestId: number): Promise<DocumentRow | null> {
    const response = await fetch(`${base}/by-request?request_id=${requestId}`, { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error("Failed to load document statuses");
    }
    const payload: unknown = await response.json().catch(() => null);
    if (!isRecord(payload) || payload.success !== true) {
        throw new Error("Failed to load document statuses");
    }
    return parseDocumentRow(payload.data);
}

function matchRequestRow(rows: DocumentRow[], requestId: number): DocumentRow | null {
    let matched: DocumentRow | null = null;
    for (const row of rows) {
        if (row.requestId !== requestId) continue;
        matched = preferApproved(matched, row);
    }
    return matched;
}

async function fetchFormDocumentChecklist(
    requestId: number,
    userId: number | null
): Promise<FormDocumentChecklist> {
    const [form, soa, quitClaimRows] = await Promise.all([
        fetchByRequest(FORM_API, requestId),
        fetchByRequest(SOA_API, requestId),
        fetchDocumentRows(QUIT_CLAIMS_API, userId === null ? "" : `user_id=${userId}`),
    ]);
    return toFormDocumentChecklist(
        requestId,
        toSnapshot(form),
        toSnapshot(soa),
        toSnapshot(matchRequestRow(quitClaimRows, requestId))
    );
}

export function useFormDocumentGate(requestId: number, userId: number | null) {
    const [checklist, setChecklist] = useState<FormDocumentChecklist | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(async (): Promise<void> => {
        setNonce((value) => value + 1);
    }, []);

    useEffect(() => {
        if (userId === null) {
            setChecklist(null);
            setIsLoading(true);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        (async () => {
            try {
                const loaded = await fetchFormDocumentChecklist(requestId, userId);
                if (!cancelled) setChecklist(loaded);
            } catch (err) {
                if (!cancelled) {
                    setChecklist(null);
                    setError(err instanceof Error ? err.message : "Failed to load document statuses");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, userId, nonce]);

    return { checklist, isLoading, error, refresh };
}
