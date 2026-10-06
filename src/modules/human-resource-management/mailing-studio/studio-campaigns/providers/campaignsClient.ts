import type { MsCampaignCreateBody, MsCampaignRow, MsCampaignUpdateBody } from "../types";

export interface CampaignConfirmCounts {
    recipientCount: number;
    suppressedCount: number;
    duplicateCount: number;
}

export interface CampaignExpandData {
    campaign: MsCampaignRow;
    queued: number;
    alreadyQueued: number;
    total_count: number;
}

export interface CampaignCancelData {
    campaign: MsCampaignRow;
    skipped: number;
}

export interface CampaignTestSeedResult {
    email: string;
    ok: boolean;
    status: string;
    reason: string | null;
}

export interface CampaignTestSendData {
    ok: boolean;
    status: string;
    reason: string | null;
    results: CampaignTestSeedResult[];
    warnings: string[];
}

export interface CampaignTemplateOption {
    id: number;
    template_key: string;
    template_name: string;
    subject: string;
    is_active: boolean | number | string | null;
}

export interface CampaignGroupOption {
    id: number;
    group_key: string;
    group_name: string;
    is_active: boolean | number | string | null;
}

export interface CampaignGroupPreview {
    recipientCount: number;
    suppressedCount: number;
    duplicateCount: number;
}

export class CampaignApiError extends Error {
    readonly status: number;
    readonly data: unknown;

    constructor(message: string, status: number, data?: unknown) {
        super(message);
        this.name = "CampaignApiError";
        this.status = status;
        this.data = data;
    }
}

export class CampaignAlreadyQueuedError extends CampaignApiError {
    readonly expansion: CampaignExpandData;

    constructor(message: string, expansion: CampaignExpandData) {
        super(message, 409, expansion);
        this.name = "CampaignAlreadyQueuedError";
        this.expansion = expansion;
    }
}

interface CampaignEnvelope<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

const CAMPAIGNS_BASE = "/api/hrm/mailing-studio/campaigns";
const TEMPLATES_BASE = "/api/hrm/mailing-studio/studio-templates";
const GROUPS_BASE = "/api/hrm/mailing-studio/groups";

function fieldDetails(errors: Record<string, string[]> | undefined): string | null {
    if (!errors) return null;
    const parts: string[] = [];
    for (const [field, messages] of Object.entries(errors)) {
        if (messages.length > 0) parts.push(`${field}: ${messages.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : null;
}

function isExpandPayload(value: unknown): value is CampaignExpandData {
    if (typeof value !== "object" || value === null) return false;
    return typeof (value as { campaign?: unknown }).campaign === "object";
}

async function request<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    const res = await fetch(`${CAMPAIGNS_BASE}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    let envelope: CampaignEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as CampaignEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (res.status === 409 && envelope && isExpandPayload(envelope.data)) {
        throw new CampaignAlreadyQueuedError(
            envelope.message ?? "This campaign is already queued.",
            envelope.data
        );
    }
    if (!res.ok || !envelope || envelope.success !== true) {
        const fallback = `Campaign request failed (HTTP ${res.status})`;
        const message = envelope?.message ?? fallback;
        const details = fieldDetails(envelope?.errors);
        throw new CampaignApiError(details ? `${message} — ${details}` : message, res.status, envelope?.data);
    }
    return envelope.data;
}

async function getJson<T>(url: string): Promise<T | undefined> {
    const res = await fetch(url);
    let envelope: CampaignEnvelope<T> | null = null;
    try {
        envelope = (await res.json()) as CampaignEnvelope<T>;
    } catch {
        envelope = null;
    }
    if (!res.ok || !envelope || envelope.success !== true) {
        throw new CampaignApiError(envelope?.message ?? `Lookup request failed (HTTP ${res.status})`, res.status);
    }
    return envelope.data;
}

export function campaignOptionIsActive(value: boolean | number | string | null | undefined): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

export function extractBannedVariables(warnings: string[]): string[] {
    const names: string[] = [];
    for (const warning of warnings) {
        if (!warning.startsWith("bulk-variables-banned:")) continue;
        for (const part of warning.slice("bulk-variables-banned:".length).split(",")) {
            const name = part.trim();
            if (name !== "" && !names.includes(name)) names.push(name);
        }
    }
    return names;
}

export async function listCampaigns(status?: string): Promise<MsCampaignRow[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await request<MsCampaignRow[]>(qs);
    return data ?? [];
}

export async function getCampaign(id: number): Promise<MsCampaignRow> {
    const data = await request<MsCampaignRow>(`/${id}`);
    if (!data) throw new CampaignApiError("Campaign was not found.", 404);
    return data;
}

export async function createCampaign(input: MsCampaignCreateBody): Promise<MsCampaignRow> {
    const data = await request<MsCampaignRow>("", { method: "POST", body: JSON.stringify(input) });
    if (!data) throw new CampaignApiError("Create returned no campaign.", 500);
    return data;
}

export async function updateCampaign(id: number, patch: MsCampaignUpdateBody): Promise<MsCampaignRow> {
    const data = await request<MsCampaignRow>(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!data) throw new CampaignApiError("Update returned no campaign.", 500);
    return data;
}

export async function deleteCampaign(id: number): Promise<MsCampaignRow> {
    const data = await request<MsCampaignRow>(`/${id}`, { method: "DELETE" });
    if (!data) throw new CampaignApiError("Delete returned no campaign.", 500);
    return data;
}

export async function confirmCampaign(id: number): Promise<CampaignConfirmCounts> {
    const data = await request<CampaignConfirmCounts>(`/${id}/confirm`, { method: "POST", body: JSON.stringify({}) });
    if (!data) throw new CampaignApiError("Confirm returned no counts.", 500);
    return data;
}

export async function expandCampaign(id: number): Promise<{ data: CampaignExpandData; repeated: boolean }> {
    try {
        const data = await request<CampaignExpandData>(`/${id}/expand`, { method: "POST", body: JSON.stringify({}) });
        if (!data) throw new CampaignApiError("Expand returned no result.", 500);
        return { data, repeated: false };
    } catch (cause) {
        if (cause instanceof CampaignAlreadyQueuedError) return { data: cause.expansion, repeated: true };
        throw cause;
    }
}

export async function cancelCampaign(id: number): Promise<CampaignCancelData> {
    const data = await request<CampaignCancelData>(`/${id}/cancel`, { method: "POST", body: JSON.stringify({}) });
    if (!data) throw new CampaignApiError("Cancel returned no result.", 500);
    return data;
}

export async function scheduleCampaign(id: number, scheduledAt: string | null): Promise<MsCampaignRow> {
    const data = await request<{ campaign: MsCampaignRow }>(`/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduled_at: scheduledAt }),
    });
    if (!data) throw new CampaignApiError("Schedule returned no campaign.", 500);
    return data.campaign;
}

export async function testSendCampaign(id: number, seeds: string[]): Promise<CampaignTestSendData> {
    const data = await request<CampaignTestSendData>(`/${id}/test-send`, {
        method: "POST",
        body: JSON.stringify({ seeds }),
    });
    if (!data) throw new CampaignApiError("Test send returned no result.", 500);
    return data;
}

export async function listCampaignTemplates(): Promise<CampaignTemplateOption[]> {
    const data = await getJson<CampaignTemplateOption[]>(`${TEMPLATES_BASE}?is_active=true`);
    return data ?? [];
}

export async function listCampaignGroups(): Promise<CampaignGroupOption[]> {
    const data = await getJson<CampaignGroupOption[]>(GROUPS_BASE);
    return data ?? [];
}

export async function previewCampaignGroup(groupId: number): Promise<CampaignGroupPreview> {
    const data = await getJson<CampaignGroupPreview>(`${GROUPS_BASE}/${encodeURIComponent(String(groupId))}/preview`);
    if (!data) throw new CampaignApiError("Group preview returned no data.", 500);
    return data;
}
