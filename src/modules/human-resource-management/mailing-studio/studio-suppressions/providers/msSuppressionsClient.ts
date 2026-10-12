import type { MsSuppressionRow, SuppressionReason } from "../types";

export interface MsSuppressionList {
    rows: MsSuppressionRow[];
    total: number;
}

export interface MsSuppressionCreateInput {
    email: string;
    reason: SuppressionReason;
    note?: string | null;
}

interface MsEnvelope {
    success: boolean;
    data?: MsSuppressionRow[];
    total?: unknown;
    message?: string;
    errors?: Record<string, string[]>;
}

interface MsRowEnvelope {
    success: boolean;
    data?: MsSuppressionRow;
    message?: string;
    errors?: Record<string, string[]>;
}

function fieldDetails(errors: Record<string, string[]> | undefined): string | null {
    if (!errors) return null;
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(errors)) {
        if (messages.length > 0) parts.push(`${field}: ${messages.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : null;
}

function listFailureMessage(envelope: MsEnvelope | null, status: number): string {
    const fallback = `Mailing Studio request failed (HTTP ${status})`;
    const message = envelope?.message ?? fallback;
    const details = fieldDetails(envelope?.errors);
    return details ? `${message} — ${details}` : message;
}

function rowFailureMessage(envelope: MsRowEnvelope | null, status: number): string {
    const fallback = `Mailing Studio request failed (HTTP ${status})`;
    const message = envelope?.message ?? fallback;
    const details = fieldDetails(envelope?.errors);
    return details ? `${message} — ${details}` : message;
}

export async function fetchMsSuppressions(reason?: SuppressionReason): Promise<MsSuppressionList> {
    const qs = reason === undefined ? "" : `?reason=${encodeURIComponent(reason)}`;
    const res = await fetch(`/api/hrm/mailing-studio/suppressions${qs}`);
    let envelope: MsEnvelope | null = null;
    try {
        envelope = (await res.json()) as MsEnvelope;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true || !Array.isArray(envelope.data)) {
        throw new Error(listFailureMessage(envelope, res.status));
    }
    const total =
        typeof envelope.total === "number" && Number.isInteger(envelope.total) && envelope.total >= 0
            ? envelope.total
            : envelope.data.length;
    return { rows: envelope.data, total };
}

export async function createMsSuppression(input: MsSuppressionCreateInput): Promise<MsSuppressionRow> {
    const res = await fetch("/api/hrm/mailing-studio/suppressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    let envelope: MsRowEnvelope | null = null;
    try {
        envelope = (await res.json()) as MsRowEnvelope;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true || !envelope.data) {
        throw new Error(rowFailureMessage(envelope, res.status));
    }
    return envelope.data;
}

export async function removeMsSuppression(id: number): Promise<string> {
    const res = await fetch(`/api/hrm/mailing-studio/suppressions/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
    });
    let envelope: MsRowEnvelope | null = null;
    try {
        envelope = (await res.json()) as MsRowEnvelope;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true) {
        throw new Error(rowFailureMessage(envelope, res.status));
    }
    return envelope.message ?? "Suppression removed.";
}
