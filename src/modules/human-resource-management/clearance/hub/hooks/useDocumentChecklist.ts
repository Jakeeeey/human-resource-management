"use client";

import { useCallback, useEffect, useState } from "react";

import {
    toClearanceDocumentChecklist,
    type ClearanceDocumentChecklist,
    type ClearanceDocumentSnapshot,
    type ClearanceDocumentState,
} from "../types";

const FORM_API = "/api/hrm/clearance/form";
const SOA_API = "/api/hrm/clearance/soa";
const QUIT_CLAIMS_API = "/api/hrm/clearance/quit-claims";
const PAGE_LIMIT = 100;

interface DocumentRow {
    id: number | null;
    requestId: number | null;
    state: ClearanceDocumentState;
    refNo: string | null;
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

function toDocumentState(value: unknown): ClearanceDocumentState | null {
    if (value === "approved") return "approved";
    if (value === "pending") return "pending";
    return null;
}

function parseDocumentRow(value: unknown): DocumentRow | null {
    if (!isRecord(value)) return null;
    const state = toDocumentState(value.status);
    if (state === null) return null;
    return {
        id: toId(value.id),
        requestId: toNullableId(value.request_id),
        state,
        refNo: toNullableText(value.ref_no),
    };
}

function toSnapshot(row: DocumentRow | null): ClearanceDocumentSnapshot | undefined {
    if (!row) return undefined;
    return { state: row.state, refNo: row.refNo, documentId: row.id };
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

function indexByRequest(rows: DocumentRow[]): Map<number, ClearanceDocumentSnapshot> {
    const map = new Map<number, ClearanceDocumentSnapshot>();
    for (const row of rows) {
        if (row.requestId === null) continue;
        const current = map.get(row.requestId);
        if (!current || (current.state !== "approved" && row.state === "approved")) {
            map.set(row.requestId, { state: row.state, refNo: row.refNo, documentId: row.id });
        }
    }
    return map;
}

export async function fetchCompletionIndex(): Promise<Map<number, ClearanceDocumentChecklist>> {
    const [forms, soas, quitClaims] = await Promise.all([
        fetchDocumentRows(FORM_API, ""),
        fetchDocumentRows(SOA_API, ""),
        fetchDocumentRows(QUIT_CLAIMS_API, ""),
    ]);
    const formsByRequest = indexByRequest(forms);
    const soasByRequest = indexByRequest(soas);
    const quitClaimsByRequest = indexByRequest(quitClaims);
    const requestIds = new Set<number>([
        ...formsByRequest.keys(),
        ...soasByRequest.keys(),
        ...quitClaimsByRequest.keys(),
    ]);
    const index = new Map<number, ClearanceDocumentChecklist>();
    for (const requestId of requestIds) {
        index.set(
            requestId,
            toClearanceDocumentChecklist(
                requestId,
                formsByRequest.get(requestId),
                soasByRequest.get(requestId),
                quitClaimsByRequest.get(requestId)
            )
        );
    }
    return index;
}

export async function fetchDocumentChecklist(
    requestId: number,
    userId: number | null
): Promise<ClearanceDocumentChecklist> {
    const [form, soa, quitClaimRows] = await Promise.all([
        fetchByRequest(FORM_API, requestId),
        fetchByRequest(SOA_API, requestId),
        fetchDocumentRows(QUIT_CLAIMS_API, userId === null ? "" : `user_id=${userId}`),
    ]);
    return toClearanceDocumentChecklist(
        requestId,
        toSnapshot(form),
        toSnapshot(soa),
        toSnapshot(matchRequestRow(quitClaimRows, requestId))
    );
}

export function useDocumentCompletionIndex() {
    const [index, setIndex] = useState<Map<number, ClearanceDocumentChecklist>>(new Map());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(async (): Promise<void> => {
        setNonce((value) => value + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        (async () => {
            try {
                const loaded = await fetchCompletionIndex();
                if (!cancelled) setIndex(loaded);
            } catch (err) {
                if (!cancelled) {
                    setIndex(new Map());
                    setError(err instanceof Error ? err.message : "Failed to load document statuses");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [nonce]);

    return { index, isLoading, error, refresh };
}

export function useDocumentChecklist(requestId: number, userId: number | null) {
    const [checklist, setChecklist] = useState<ClearanceDocumentChecklist | null>(null);
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
                const loaded = await fetchDocumentChecklist(requestId, userId);
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
