"use client";

import { useCallback, useEffect, useState } from "react";

export type FormSignerType = "pool" | "subject_department" | "named_department" | "all";

export interface RequestSignatoryCandidate {
    user_id: number;
    full_name: string;
    department_name: string | null;
}

export interface RequestSignatoryItem {
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

function toSignerType(value: unknown): FormSignerType | null {
    if (value === "pool" || value === "subject_department" || value === "named_department" || value === "all") {
        return value;
    }
    return null;
}

function parseItem(value: unknown): RequestSignatoryItem | null {
    if (!isRecord(value)) return null;
    const id = toId(value.id);
    const requestId = toId(value.request_id);
    const categoryId = toId(value.category_id);
    const label = toNullableText(value.label_snapshot);
    const signerType = toSignerType(value.signer_type_snapshot);
    if (id === null || requestId === null || categoryId === null || label === null || signerType === null) {
        return null;
    }
    return {
        id,
        request_id: requestId,
        category_id: categoryId,
        label_snapshot: label,
        instructions_snapshot: toNullableText(value.instructions_snapshot),
        signer_type_snapshot: signerType,
        department_id_snapshot: toNullableId(value.department_id_snapshot),
        department_name_snapshot: toNullableText(value.department_name_snapshot),
        sort_order: toId(value.sort_order) ?? 0,
        status: typeof value.status === "string" ? value.status : "pending",
        signatory_id: toNullableId(value.signatory_id),
    };
}

function parseCandidate(value: unknown): RequestSignatoryCandidate | null {
    if (!isRecord(value)) return null;
    const userId = toId(value.user_id);
    const fullName = toNullableText(value.full_name);
    if (userId === null || fullName === null) return null;
    return {
        user_id: userId,
        full_name: fullName,
        department_name: toNullableText(value.department_name),
    };
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

export function useRequestSignatories(requestId: number) {
    const [items, setItems] = useState<RequestSignatoryItem[]>([]);
    const [candidates, setCandidates] = useState<Record<number, RequestSignatoryCandidate[]>>({});
    const [selections, setSelections] = useState<Record<number, number | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
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
                const response = await fetch(`/api/hrm/clearance/requests/${requestId}/signatories`, {
                    cache: "no-store",
                });
                if (!response.ok) throw new Error(await readErrorMessage(response, "Failed to load signatories"));
                const payload: unknown = await response.json().catch(() => null);
                if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
                    throw new Error("Failed to load signatories");
                }
                const rawItems = Array.isArray(payload.data.items) ? payload.data.items : [];
                const parsed = rawItems
                    .map(parseItem)
                    .filter((item): item is RequestSignatoryItem => item !== null)
                    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
                const rawCandidates = isRecord(payload.data.candidates) ? payload.data.candidates : {};
                const nextCandidates: Record<number, RequestSignatoryCandidate[]> = {};
                for (const [key, value] of Object.entries(rawCandidates)) {
                    const itemId = toId(key);
                    if (itemId === null || !Array.isArray(value)) continue;
                    nextCandidates[itemId] = value
                        .map(parseCandidate)
                        .filter((candidate): candidate is RequestSignatoryCandidate => candidate !== null);
                }
                if (cancelled) return;
                setItems(parsed);
                setCandidates(nextCandidates);
                const nextSelections: Record<number, number | null> = {};
                for (const item of parsed) nextSelections[item.id] = item.signatory_id;
                setSelections(nextSelections);
            } catch (err) {
                if (!cancelled) {
                    setItems([]);
                    setCandidates({});
                    setSelections({});
                    setError(err instanceof Error ? err.message : "Failed to load signatories");
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [requestId, nonce]);

    const setSelection = useCallback((itemId: number, signatoryId: number | null) => {
        setSelections((prev) => ({ ...prev, [itemId]: signatoryId }));
    }, []);

    const changedAssignments = items
        .filter((item) => (selections[item.id] ?? null) !== item.signatory_id)
        .map((item) => ({ item_id: item.id, signatory_id: selections[item.id] ?? null }));

    const save = useCallback(async (): Promise<void> => {
        if (changedAssignments.length === 0) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/hrm/clearance/requests/${requestId}/signatories`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments: changedAssignments }),
            });
            if (!response.ok) throw new Error(await readErrorMessage(response, "Failed to save signatories"));
            const payload: unknown = await response.json().catch(() => null);
            if (!isRecord(payload) || payload.success !== true) throw new Error("Failed to save signatories");
            const rawItems: unknown[] = isRecord(payload.data) && Array.isArray(payload.data.items)
                ? payload.data.items
                : [];
            const parsed = rawItems
                .map(parseItem)
                .filter((item): item is RequestSignatoryItem => item !== null)
                .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
            if (parsed.length > 0) {
                setItems(parsed);
                const nextSelections: Record<number, number | null> = {};
                for (const item of parsed) nextSelections[item.id] = item.signatory_id;
                setSelections(nextSelections);
            } else {
                setNonce((value) => value + 1);
            }
        } finally {
            setIsSaving(false);
        }
    }, [changedAssignments, requestId]);

    return {
        items,
        candidates,
        selections,
        setSelection,
        changedCount: changedAssignments.length,
        isLoading,
        error,
        isSaving,
        refresh,
        save,
    };
}
