import { NextResponse } from "next/server";

import {
    fetchActiveTemplate,
    resolveTemplateBodyHtml,
    takeRateSlot,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import {
    getMsMailConfigStatus,
    getMsMailTransport,
    msLogRedacted,
    msScrubSecretsFromText,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/mail-transport";
import {
    MS_INLINE_IMAGE_WARN_BYTES,
    fetchMsAssetBytes,
    msAssetFilename,
    msCidRefsInHtml,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/ms-asset-fetch";
import { mailHtmlToText } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-mail-text";
import {
    msAssertMailableHtml,
    msHasForbiddenMailHtml,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-html-scrub";
import { extractTemplateTokens } from "@/modules/human-resource-management/mailing-studio/studio-send/utils/template-render";
import {
    GroupNotFoundError,
    getGroup,
    listMembers,
    normalizeEmail,
} from "@/modules/human-resource-management/mailing-studio/studio-groups/server/groupService";

import { unwrapStudioCampaignsData } from "./capability";
import type {
    CampaignStatus,
    MsCampaignCreateBody,
    MsCampaignRow,
    MsCampaignUpdateBody,
} from "../types";
import { creationTimestamps, nowUTC, stampCreate, stampUpdate } from "../utils/audit";
import { dFetch } from "../utils/directus";

export class CampaignNotFoundError extends Error {
    readonly status = 404;

    constructor(message: string) {
        super(message);
        this.name = "CampaignNotFoundError";
    }
}

export class CampaignConflictError extends Error {
    readonly status = 409;

    constructor(message: string) {
        super(message);
        this.name = "CampaignConflictError";
    }
}

export class CampaignValidationError extends Error {
    readonly status = 422;

    constructor(message: string) {
        super(message);
        this.name = "CampaignValidationError";
    }
}

export function toCampaignErrorResponse(error: unknown): NextResponse {
    if (
        error instanceof CampaignNotFoundError ||
        error instanceof CampaignConflictError ||
        error instanceof CampaignValidationError
    ) {
        return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    return NextResponse.json(
        { success: false, message: "An unexpected error occurred. Please try again later." },
        { status: 500 }
    );
}

export interface ConfirmResult {
    recipientCount: number;
    suppressedCount: number;
    duplicateCount: number;
}

export interface ConfirmAudienceResult extends ConfirmResult {
    bannedVariables: string[];
}

export interface ExpandResult {
    campaign: MsCampaignRow;
    queued: number;
    alreadyQueued: number;
    total_count: number;
    repeated: boolean;
}

export interface CancelResult {
    campaign: MsCampaignRow;
    skipped: number;
}

export interface DeleteCampaignResult {
    campaign: MsCampaignRow;
}

export interface TestSendSeedResult {
    email: string;
    ok: boolean;
    status: string;
    reason: string | null;
}

export interface TestSendResult {
    ok: boolean;
    status: string;
    reason: string | null;
    results: TestSendSeedResult[];
    warnings: string[];
}

interface Resolution extends ConfirmResult {
    recipients: string[];
}

const CAMPAIGNS = "/items/ms_campaigns";
const OUTBOX = "/items/ms_outbox";
const OUTBOX_CLAIMS = "/items/ms_outbox_claims";
const SUPPRESSIONS = "/items/ms_suppressions";
const CAMPAIGN_FIELDS =
    "id,campaign_key,campaign_name,template_id,group_ids,status,scheduled_at,started_at,finished_at,total_count,sent_count,failed_count,skipped_count,run_seq,created_at,created_by,updated_at,updated_by";
const SUPPRESSION_CHUNK = 200;
const OUTBOX_BATCH = 20;
const OUTBOX_DELETE_BATCH = 100;
const TEST_SEND_MAX_SEEDS = 5;

export const CAMPAIGNS_PAGE_DEFAULT_LIMIT = 10;
export const CAMPAIGNS_PAGE_MAX_LIMIT = 50;
export const DELIVERIES_PAGE_DEFAULT_LIMIT = 25;
export const DELIVERIES_PAGE_MAX_LIMIT = 100;

const DELETABLE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
    "draft",
    "scheduled",
    "cancelled",
    "sent",
    "failed",
];

const DELIVERY_FIELDS = "id,to_email,status,attempts,error,published_at,sent_at,next_attempt_at";

export const CAMPAIGN_SORT_VALUES = [
    "created-desc",
    "created-asc",
    "name-asc",
    "name-desc",
    "status-asc",
    "status-desc",
] as const;

export type CampaignSort = (typeof CAMPAIGN_SORT_VALUES)[number];

const CAMPAIGN_SORT_MAP: Record<CampaignSort, string> = {
    "created-desc": "-created_at",
    "created-asc": "created_at",
    "name-asc": "campaign_name",
    "name-desc": "-campaign_name",
    "status-asc": "status",
    "status-desc": "-status",
};

export interface CampaignsPage {
    rows: MsCampaignRow[];
    total: number;
    page: number;
    limit: number;
}

function isDuplicateMessage(message: string): boolean {
    const text = message.toLowerCase();
    return text.includes("duplicate") || text.includes("unique") || text.includes("already exists");
}

function throwIfDirectusErrors(body: unknown, context: string): void {
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        const message =
            Array.isArray(errors) && errors.length > 0
                ? errors.map((entry) => entry.message ?? "unknown error").join("; ")
                : context;
        if (isDuplicateMessage(message)) {
            throw new CampaignConflictError(message);
        }
        throw new Error(`${context}: ${message}`);
    }
}

function isActiveFlag(value: boolean | number): boolean {
    return value === true || value === 1;
}

function coerceGroupIds(value: unknown): number[] {
    if (Array.isArray(value)) {
        const ids: number[] = [];
        for (const entry of value) {
            if (typeof entry === "number" && Number.isInteger(entry) && entry > 0 && !ids.includes(entry)) {
                ids.push(entry);
            }
        }
        return ids;
    }
    if (typeof value === "string") {
        const text = value.trim();
        if (text === "") return [];
        try {
            const parsed: unknown = JSON.parse(text);
            if (Array.isArray(parsed)) return coerceGroupIds(parsed);
        } catch {
            const ids: number[] = [];
            for (const part of text.split(",")) {
                const id = Number(part.trim());
                if (Number.isInteger(id) && id > 0 && !ids.includes(id)) {
                    ids.push(id);
                }
            }
            return ids;
        }
        return [];
    }
    return [];
}

async function readCampaignRow(id: number): Promise<MsCampaignRow | null> {
    const body = await dFetch(`${CAMPAIGNS}?filter[id][_eq]=${id}&fields=${CAMPAIGN_FIELDS}&limit=1`);
    const rows = unwrapStudioCampaignsData<MsCampaignRow[]>(body);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function readSuppressedSet(emails: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (let offset = 0; offset < emails.length; offset += SUPPRESSION_CHUNK) {
        const chunk = emails.slice(offset, offset + SUPPRESSION_CHUNK);
        const filter = chunk.map((email) => encodeURIComponent(email)).join(",");
        const body = await dFetch(`${SUPPRESSIONS}?filter[email][_in]=${filter}&fields=email&limit=-1`);
        const rows = unwrapStudioCampaignsData<Array<{ email?: unknown }>>(body);
        if (Array.isArray(rows)) {
            for (const row of rows) {
                if (typeof row.email === "string" && row.email.trim() !== "") {
                    found.add(normalizeEmail(row.email));
                }
            }
        }
    }
    return found;
}

async function resolveRecipients(groupIds: number[]): Promise<Resolution> {
    const flat: string[] = [];
    for (const groupId of groupIds) {
        let groupActive = true;
        try {
            const group = await getGroup(groupId);
            groupActive = isActiveFlag(group.is_active);
            if (!groupActive) continue;
            const members = await listMembers(groupId);
            for (const member of members) {
                if (!isActiveFlag(member.is_active)) continue;
                const email = normalizeEmail(member.email);
                if (email !== "") flat.push(email);
            }
        } catch (error) {
            if (error instanceof GroupNotFoundError) continue;
            throw error;
        }
    }
    const distinct = Array.from(new Set(flat));
    const duplicateCount = flat.length - distinct.length;
    const suppressed = await readSuppressedSet(distinct);
    const recipients = distinct.filter((email) => !suppressed.has(email));
    return {
        recipients,
        recipientCount: recipients.length,
        suppressedCount: suppressed.size,
        duplicateCount,
    };
}

async function assertGroupsExist(groupIds: number[]): Promise<void> {
    for (const groupId of groupIds) {
        try {
            await getGroup(groupId);
        } catch (error) {
            if (error instanceof GroupNotFoundError) {
                throw new CampaignValidationError(`Unknown group id ${groupId}`);
            }
            throw error;
        }
    }
}

async function assertTemplateUsable(templateId: number | null | undefined): Promise<void> {
    if (templateId === null || templateId === undefined) return;
    const template = await fetchActiveTemplate(templateId);
    if (!template) {
        throw new CampaignValidationError("Template not found or inactive");
    }
}

async function readExistingOutboxKeys(campaignId: number): Promise<Set<string>> {
    const body = await dFetch(`${OUTBOX}?filter[campaign_id][_eq]=${campaignId}&fields=idempotency_key&limit=-1`);
    const rows = unwrapStudioCampaignsData<Array<{ idempotency_key?: unknown }>>(body);
    const keys = new Set<string>();
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (typeof row.idempotency_key === "string" && row.idempotency_key !== "") {
                keys.add(row.idempotency_key);
            }
        }
    }
    return keys;
}

async function readOutboxRowIds(campaignId: number): Promise<Array<string | number>> {
    const body = await dFetch(`${OUTBOX}?filter[campaign_id][_eq]=${campaignId}&fields=id&sort=id&limit=-1`);
    const rows = unwrapStudioCampaignsData<Array<{ id?: unknown }>>(body);
    const ids: Array<string | number> = [];
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (typeof row.id === "string" || typeof row.id === "number") {
                ids.push(row.id);
            }
        }
    }
    return ids;
}

async function deleteOutboxClaims(outboxIds: Array<string | number>): Promise<void> {
    const filter = outboxIds.map((rowId) => encodeURIComponent(String(rowId))).join(",");
    const body = await dFetch(`${OUTBOX_CLAIMS}?filter[outbox_id][_in]=${filter}&fields=id&limit=-1`);
    const rows = unwrapStudioCampaignsData<Array<{ id?: unknown }>>(body);
    const claimIds: Array<string | number> = [];
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (typeof row.id === "string" || typeof row.id === "number") {
                claimIds.push(row.id);
            }
        }
    }
    for (let offset = 0; offset < claimIds.length; offset += OUTBOX_DELETE_BATCH) {
        const chunk = claimIds.slice(offset, offset + OUTBOX_DELETE_BATCH);
        await Promise.all(
            chunk.map((claimId) =>
                dFetch(`${OUTBOX_CLAIMS}/${encodeURIComponent(String(claimId))}`, { method: "DELETE" })
            )
        );
    }
}

async function deleteCampaignOutbox(campaignId: number): Promise<void> {
    const ids = await readOutboxRowIds(campaignId);
    for (let offset = 0; offset < ids.length; offset += OUTBOX_DELETE_BATCH) {
        const chunk = ids.slice(offset, offset + OUTBOX_DELETE_BATCH);
        await deleteOutboxClaims(chunk);
        await Promise.all(
            chunk.map((rowId) =>
                dFetch(`${OUTBOX}/${encodeURIComponent(String(rowId))}`, { method: "DELETE" })
            )
        );
    }
}

async function postBulkRow(row: Record<string, unknown>): Promise<boolean> {
    let body: unknown;
    try {
        body = await dFetch(OUTBOX, { method: "POST", body: JSON.stringify(row) });
    } catch (error) {
        if (error instanceof Error && isDuplicateMessage(error.message)) return false;
        throw error;
    }
    if (typeof body === "object" && body !== null && "errors" in body) {
        const errors = (body as { errors?: Array<{ message?: string }> }).errors;
        const message =
            Array.isArray(errors) && errors.length > 0
                ? errors.map((entry) => entry.message ?? "unknown error").join("; ")
                : "Failed to queue recipient";
        if (isDuplicateMessage(message)) return false;
        throw new Error(`Failed to queue recipient: ${message}`);
    }
    return true;
}

export interface ListCampaignsParams {
    page: number;
    limit: number;
    sort: CampaignSort;
    status?: CampaignStatus;
    search?: string;
}

export async function listCampaignsPage(params: ListCampaignsParams): Promise<CampaignsPage> {
    const page = Number.isInteger(params.page) && params.page > 0 ? params.page : 1;
    const limit =
        Number.isInteger(params.limit) && params.limit > 0
            ? Math.min(params.limit, CAMPAIGNS_PAGE_MAX_LIMIT)
            : CAMPAIGNS_PAGE_DEFAULT_LIMIT;
    const offset = (page - 1) * limit;
    const statusFilter = params.status === undefined ? "" : `&filter[status][_eq]=${params.status}`;
    const search = (params.search ?? "").trim();
    const searchFilter =
        search === ""
            ? ""
            : `&filter[_or][0][campaign_name][_contains]=${encodeURIComponent(search)}` +
              `&filter[_or][1][campaign_key][_contains]=${encodeURIComponent(search)}`;
    const sort = CAMPAIGN_SORT_MAP[params.sort];
    const body = await dFetch(
        `${CAMPAIGNS}?fields=${CAMPAIGN_FIELDS}&sort=${encodeURIComponent(sort)}` +
            `&limit=${limit}&offset=${offset}&meta=filter_count${statusFilter}${searchFilter}`
    );
    const rows = unwrapStudioCampaignsData<MsCampaignRow[]>(body);
    const meta =
        typeof body === "object" && body !== null
            ? (body as { meta?: { filter_count?: unknown } }).meta
            : undefined;
    const total =
        typeof meta?.filter_count === "number"
            ? meta.filter_count
            : Array.isArray(rows)
              ? rows.length
              : 0;
    return { rows: Array.isArray(rows) ? rows : [], total, page, limit };
}

export async function getCampaign(id: number): Promise<MsCampaignRow> {
    const row = await readCampaignRow(id);
    if (!row) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    return row;
}

export interface CampaignDeliveryRow {
    id: string | number;
    to_email: string;
    status: string;
    attempts: number;
    error: string | null;
    published_at: string | null;
    sent_at: string | null;
}

export interface CampaignDeliveriesPage {
    rows: CampaignDeliveryRow[];
    total: number;
    page: number;
    limit: number;
}

export interface ListCampaignDeliveriesParams {
    page: number;
    limit: number;
}

function toDeliveryRow(raw: unknown): CampaignDeliveryRow | null {
    if (typeof raw !== "object" || raw === null) return null;
    const row = raw as Record<string, unknown>;
    const id = row.id;
    if (typeof id !== "string" && typeof id !== "number") return null;
    return {
        id,
        to_email: typeof row.to_email === "string" ? row.to_email : "",
        status: typeof row.status === "string" ? row.status : "unknown",
        attempts:
            typeof row.attempts === "number" && Number.isInteger(row.attempts) && row.attempts >= 0
                ? row.attempts
                : 0,
        error: typeof row.error === "string" ? row.error : null,
        published_at: typeof row.published_at === "string" ? row.published_at : null,
        sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    };
}

export async function listCampaignDeliveriesPage(
    campaignId: number,
    params: ListCampaignDeliveriesParams
): Promise<CampaignDeliveriesPage> {
    const campaign = await readCampaignRow(campaignId);
    if (!campaign) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    const page = Number.isInteger(params.page) && params.page > 0 ? params.page : 1;
    const limit =
        Number.isInteger(params.limit) && params.limit > 0
            ? Math.min(params.limit, DELIVERIES_PAGE_MAX_LIMIT)
            : DELIVERIES_PAGE_DEFAULT_LIMIT;
    const offset = (page - 1) * limit;
    const body = await dFetch(
        `${OUTBOX}?filter[campaign_id][_eq]=${campaignId}&fields=${DELIVERY_FIELDS}` +
            `&sort=id&limit=${limit}&offset=${offset}&meta=filter_count`
    );
    const rawRows = unwrapStudioCampaignsData<unknown[]>(body);
    const rows: CampaignDeliveryRow[] = [];
    if (Array.isArray(rawRows)) {
        for (const raw of rawRows) {
            const row = toDeliveryRow(raw);
            if (row) rows.push(row);
        }
    }
    const meta =
        typeof body === "object" && body !== null
            ? (body as { meta?: { filter_count?: unknown } }).meta
            : undefined;
    const total = typeof meta?.filter_count === "number" ? meta.filter_count : rows.length;
    return { rows, total, page, limit };
}

export async function createCampaign(input: MsCampaignCreateBody, actor: string | null): Promise<MsCampaignRow> {
    const key = input.campaign_key.trim();
    const lookup = await dFetch(`${CAMPAIGNS}?filter[campaign_key][_eq]=${encodeURIComponent(key)}&fields=id&limit=1`);
    const holders = unwrapStudioCampaignsData<MsCampaignRow[]>(lookup);
    if (Array.isArray(holders) && holders.length > 0) {
        throw new CampaignConflictError(`campaign_key "${key}" is already in use`);
    }
    await assertGroupsExist(input.group_ids);
    await assertTemplateUsable(input.template_id ?? null);
    const payload = stampCreate(
        {
            ...creationTimestamps(),
            campaign_key: key,
            campaign_name: input.campaign_name.trim(),
            template_id: input.template_id ?? null,
            group_ids: [...input.group_ids],
            status: "draft",
            scheduled_at: input.scheduled_at ?? null,
            started_at: null,
            finished_at: null,
            total_count: 0,
            sent_count: 0,
            failed_count: 0,
            skipped_count: 0,
            run_seq: 0,
        },
        actor
    );
    const body = await dFetch(CAMPAIGNS, { method: "POST", body: JSON.stringify(payload) });
    throwIfDirectusErrors(body, "Failed to create campaign");
    return unwrapStudioCampaignsData<MsCampaignRow>(body);
}

export async function updateCampaign(
    id: number,
    patch: MsCampaignUpdateBody,
    actor: string | null
): Promise<MsCampaignRow> {
    const existing = await readCampaignRow(id);
    if (!existing) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    if (existing.status !== "draft") {
        throw new CampaignConflictError(`Only draft campaigns can be edited (status is "${existing.status}")`);
    }
    if (patch.group_ids !== undefined) {
        await assertGroupsExist(patch.group_ids);
    }
    if (patch.template_id !== undefined) {
        await assertTemplateUsable(patch.template_id ?? null);
    }
    const payload = stampUpdate(
        {
            ...(patch.campaign_name !== undefined ? { campaign_name: patch.campaign_name.trim() } : {}),
            ...(patch.template_id !== undefined ? { template_id: patch.template_id ?? null } : {}),
            ...(patch.group_ids !== undefined ? { group_ids: [...patch.group_ids] } : {}),
            ...(patch.scheduled_at !== undefined ? { scheduled_at: patch.scheduled_at ?? null } : {}),
            updated_at: nowUTC(),
        },
        actor
    );
    const body = await dFetch(`${CAMPAIGNS}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    throwIfDirectusErrors(body, "Failed to update campaign");
    const reread = await readCampaignRow(id);
    if (!reread) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    return reread;
}

export async function softDeleteCampaign(id: number): Promise<DeleteCampaignResult> {
    const existing = await readCampaignRow(id);
    if (!existing) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    if (!DELETABLE_CAMPAIGN_STATUSES.includes(existing.status)) {
        throw new CampaignConflictError(
            `Only draft, scheduled, cancelled, sent or failed campaigns can be deleted (status is "${existing.status}")`
        );
    }
    await deleteCampaignOutbox(id);
    await dFetch(`${CAMPAIGNS}/${id}`, { method: "DELETE" });
    return { campaign: existing };
}

async function readBannedVariables(templateId: number | null | undefined): Promise<string[]> {
    if (templateId === null || templateId === undefined) return [];
    try {
        const template = await fetchActiveTemplate(templateId);
        if (!template) return [];
        return extractTemplateTokens(`${template.subject}\n${template.body_html}`);
    } catch (error) {
        msLogRedacted("[studio-campaigns] variable check failed:", error);
        return [];
    }
}

export async function confirmCampaign(id: number): Promise<ConfirmAudienceResult> {
    const campaign = await readCampaignRow(id);
    if (!campaign) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    const resolution = await resolveRecipients(coerceGroupIds(campaign.group_ids));
    return {
        recipientCount: resolution.recipientCount,
        suppressedCount: resolution.suppressedCount,
        duplicateCount: resolution.duplicateCount,
        bannedVariables: await readBannedVariables(campaign.template_id),
    };
}

function toExpandResult(
    campaign: MsCampaignRow,
    queued: number,
    alreadyQueued: number,
    repeated: boolean
): ExpandResult {
    return { campaign, queued, alreadyQueued, total_count: campaign.total_count, repeated };
}

export async function expandCampaign(id: number, actor: string | null): Promise<ExpandResult> {
    const campaign = await readCampaignRow(id);
    if (!campaign) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    if (campaign.status === "queued" || campaign.status === "sending") {
        const keys = await readExistingOutboxKeys(id);
        const reread = (await readCampaignRow(id)) ?? campaign;
        return toExpandResult(reread, 0, keys.size, true);
    }
    if (campaign.status !== "draft" && campaign.status !== "scheduled" && campaign.status !== "sent" && campaign.status !== "cancelled" && campaign.status !== "failed") {
        throw new CampaignConflictError(`Only draft, scheduled, sent, cancelled or failed campaigns can be expanded (status is "${campaign.status}")`);
    }
    if (campaign.template_id === null || campaign.template_id === undefined) {
        throw new CampaignValidationError("Campaign has no template selected");
    }
    const template = await fetchActiveTemplate(campaign.template_id);
    if (!template) {
        throw new CampaignValidationError("Template not found or inactive");
    }
    const resolution = await resolveRecipients(coerceGroupIds(campaign.group_ids));
    const storedRun = Number(campaign.run_seq ?? 0);
    const currentRun = Number.isInteger(storedRun) && storedRun >= 0 ? storedRun : 0;
    const nextRun = currentRun + 1;
    const startedAt = nowUTC();
    const claimedBody = await dFetch(CAMPAIGNS, {
        method: "PATCH",
        body: JSON.stringify({
            query: {
                filter: {
                    id: { _eq: id },
                    status: { _in: ["draft", "scheduled", "sent", "cancelled", "failed"] },
                    run_seq: { _eq: currentRun },
                },
            },
            data: stampUpdate(
                {
                    status: "queued",
                    run_seq: nextRun,
                    total_count: resolution.recipients.length,
                    sent_count: 0,
                    failed_count: 0,
                    skipped_count: 0,
                    started_at: startedAt,
                    finished_at: null,
                    updated_at: startedAt,
                },
                actor
            ),
        }),
    });
    const claimedRows = unwrapStudioCampaignsData<MsCampaignRow[]>(claimedBody);
    if (!Array.isArray(claimedRows) || claimedRows.length === 0) {
        const reread = await readCampaignRow(id);
        if (reread && (reread.status === "queued" || reread.status === "sending")) {
            const keys = await readExistingOutboxKeys(id);
            return toExpandResult(reread, 0, keys.size, true);
        }
        throw new CampaignConflictError("Campaign was expanded by another request — please review its current status");
    }
    const runKey = (email: string): string => `${campaign.campaign_key}:${nextRun}:${email}`;
    const prior = await readExistingOutboxKeys(id);
    const pending = resolution.recipients.filter((email) => !prior.has(runKey(email)));
    let queued = 0;
    let alreadyQueued = resolution.recipients.length - pending.length;
    for (let offset = 0; offset < pending.length; offset += OUTBOX_BATCH) {
        const chunk = pending.slice(offset, offset + OUTBOX_BATCH);
        const outcomes = await Promise.all(
            chunk.map((email) =>
                postBulkRow({
                    idempotency_key: runKey(email),
                    campaign_id: id,
                    to_email: email,
                    template_id: campaign.template_id,
                    status: "queued",
                    published_at: null,
                    sent_at: null,
                    error: null,
                    warnings: [],
                    rendered_subject: null,
                    rendered_body_html: null,
                })
            )
        );
        for (const created of outcomes) {
            if (created) {
                queued += 1;
            } else {
                alreadyQueued += 1;
            }
        }
    }
    const reread = await readCampaignRow(id);
    if (!reread) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    return toExpandResult(reread, queued, alreadyQueued, false);
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

function utcNowString(): string {
    return new Date().toISOString().slice(0, 19);
}

function toUtcTimestamp(value: string): string | null {
    const text = value.trim();
    const bare = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
    if (bare) {
        const year = Number(bare[1]);
        const month = Number(bare[2]);
        const day = Number(bare[3]);
        const hour = Number(bare[4]);
        const minute = Number(bare[5]);
        const second = bare[6] === undefined ? 0 : Number(bare[6]);
        if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
            return null;
        }
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
        if (day > daysInMonth) return null;
        return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - PH_OFFSET_MS)
            .toISOString()
            .slice(0, 19);
    }
    const parsed = Date.parse(text);
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed).toISOString().slice(0, 19);
}

export async function promoteDueScheduledCampaigns(limit: number): Promise<number> {
    const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const now = utcNowString();
    const body = await dFetch(
        `${CAMPAIGNS}?filter[status][_eq]=scheduled&filter[scheduled_at][_lte]=${encodeURIComponent(now)}&sort=scheduled_at&limit=${bounded}&fields=${CAMPAIGN_FIELDS}`
    );
    const rows = unwrapStudioCampaignsData<MsCampaignRow[]>(body);
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    let promoted = 0;
    for (const row of rows) {
        try {
            const result = await expandCampaign(row.id, "scheduler");
            if (!result.repeated) promoted += 1;
        } catch (error) {
            msLogRedacted("[studio-campaigns] scheduled promote failed:", { campaign_id: row.id, error });
        }
    }
    return promoted;
}

export async function scheduleCampaign(
    id: number,
    scheduledAt: string | null | undefined,
    actor: string | null
): Promise<MsCampaignRow> {
    const existing = await readCampaignRow(id);
    if (!existing) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    if (typeof scheduledAt === "string") {
        if (scheduledAt.trim() === "") {
            throw new CampaignValidationError("scheduled_at must be a valid future datetime or null");
        }
        const candidate = toUtcTimestamp(scheduledAt);
        if (candidate === null) {
            throw new CampaignValidationError("scheduled_at must be a valid datetime");
        }
        if (candidate <= utcNowString()) {
            throw new CampaignValidationError("scheduled_at must be a future time");
        }
        if (existing.status !== "draft" && existing.status !== "scheduled") {
            throw new CampaignConflictError(
                `Only draft or scheduled campaigns can be scheduled (status is "${existing.status}")`
            );
        }
        const payload = stampUpdate({ status: "scheduled", scheduled_at: candidate }, actor);
        const body = await dFetch(`${CAMPAIGNS}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
        throwIfDirectusErrors(body, "Failed to schedule campaign");
        const reread = await readCampaignRow(id);
        if (!reread) {
            throw new CampaignNotFoundError("Campaign not found");
        }
        return reread;
    }
    if (existing.status !== "scheduled") {
        throw new CampaignConflictError(
            `Only scheduled campaigns can be unscheduled (status is "${existing.status}")`
        );
    }
    const payload = stampUpdate({ status: "draft", scheduled_at: null }, actor);
    const body = await dFetch(`${CAMPAIGNS}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    throwIfDirectusErrors(body, "Failed to unschedule campaign");
    const reread = await readCampaignRow(id);
    if (!reread) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    return reread;
}

export async function cancelCampaign(id: number, actor: string | null): Promise<CancelResult> {
    const campaign = await readCampaignRow(id);
    if (!campaign) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    if (campaign.status !== "queued" && campaign.status !== "sending") {
        throw new CampaignConflictError(`Only queued or sending campaigns can be cancelled (status is "${campaign.status}")`);
    }
    const body = await dFetch(
        `${OUTBOX}?filter[campaign_id][_eq]=${id}&filter[published_at][_null]=true&fields=id&limit=-1`
    );
    const rows = unwrapStudioCampaignsData<Array<{ id?: unknown }>>(body);
    const ids: Array<string | number> = [];
    if (Array.isArray(rows)) {
        for (const row of rows) {
            if (typeof row.id === "string" || typeof row.id === "number") {
                ids.push(row.id);
            }
        }
    }
    const now = nowUTC();
    let skipped = 0;
    for (let offset = 0; offset < ids.length; offset += OUTBOX_BATCH) {
        const chunk = ids.slice(offset, offset + OUTBOX_BATCH);
        await Promise.all(
            chunk.map((rowId) =>
                dFetch(`${OUTBOX}/${encodeURIComponent(String(rowId))}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: "skipped", published_at: now }),
                })
            )
        );
        skipped += chunk.length;
    }
    const patchBody = await dFetch(
        `${CAMPAIGNS}/${id}`,
        {
            method: "PATCH",
            body: JSON.stringify(
                stampUpdate(
                    { status: "cancelled", skipped_count: skipped, finished_at: now, updated_at: now },
                    actor
                )
            ),
        }
    );
    throwIfDirectusErrors(patchBody, "Failed to cancel campaign");
    const reread = await readCampaignRow(id);
    if (!reread) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    return { campaign: reread, skipped };
}

export async function testSendCampaign(
    campaignId: number,
    seeds: string[],
    actor: string | null
): Promise<TestSendResult> {
    const campaign = await readCampaignRow(campaignId);
    if (!campaign) {
        throw new CampaignNotFoundError("Campaign not found");
    }
    const clean = Array.from(
        new Set(seeds.map((entry) => normalizeEmail(entry)).filter((entry) => entry !== ""))
    );
    if (clean.length === 0) {
        throw new CampaignValidationError("At least one seed address is required");
    }
    if (clean.length > TEST_SEND_MAX_SEEDS) {
        throw new CampaignValidationError(`At most ${TEST_SEND_MAX_SEEDS} seed addresses are allowed`);
    }
    if (campaign.template_id === null || campaign.template_id === undefined) {
        throw new CampaignValidationError("Campaign has no template selected");
    }
    const template = await fetchActiveTemplate(campaign.template_id);
    if (!template) {
        throw new CampaignValidationError("Template not found or inactive");
    }
    const resolved = await resolveTemplateBodyHtml(template);
    const warnings = ["test-send", ...resolved.warnings];
    const tokens = extractTemplateTokens(`${template.subject}\n${resolved.html}`);
    if (tokens.length > 0) {
        warnings.push(`bulk-variables-banned:${tokens.join(",")}`);
    }
    const forbidden = msAssertMailableHtml(resolved.html);
    if (msHasForbiddenMailHtml(resolved.html) || forbidden) {
        return {
            ok: false,
            status: "skipped",
            reason: "forbidden-html",
            results: clean.map((email) => ({ email, ok: false, status: "skipped", reason: "forbidden-html" })),
            warnings: [...warnings, `forbidden-html:${forbidden ?? "rejected"}`],
        };
    }
    const suppressed = await readSuppressedSet(clean);
    const targets = clean.filter((email) => !suppressed.has(email));
    const results: TestSendSeedResult[] = clean
        .filter((email) => suppressed.has(email))
        .map((email) => ({ email, ok: false, status: "skipped", reason: "suppressed" }));
    const config = getMsMailConfigStatus();
    if (!takeRateSlot(config.ratePerMinute)) {
        for (const email of targets) {
            results.push({ email, ok: false, status: "skipped", reason: "rate-capped" });
        }
        results.sort((left, right) => clean.indexOf(left.email) - clean.indexOf(right.email));
        return { ok: false, status: "skipped", reason: "rate-capped", results, warnings: [...warnings, "rate-capped"] };
    }
    if (config.dryRun) {
        for (const email of targets) {
            results.push({ email, ok: true, status: "dry_run", reason: null });
        }
        results.sort((left, right) => clean.indexOf(left.email) - clean.indexOf(right.email));
        return { ok: true, status: "dry_run", reason: null, results, warnings };
    }
    const textBody = mailHtmlToText(resolved.html);
    const inlineCids = msCidRefsInHtml(resolved.html);
    const inlineAttachments: { cid: string; filename: string; content: Buffer; contentType: string }[] = [];
    let inlineBytesTotal = 0;
    for (const assetId of inlineCids) {
        try {
            const asset = await fetchMsAssetBytes(assetId);
            inlineAttachments.push({
                cid: assetId,
                filename: msAssetFilename(assetId, asset.contentType),
                content: asset.bytes,
                contentType: asset.contentType,
            });
            inlineBytesTotal += asset.size;
        } catch (error) {
            msLogRedacted("[studio-campaigns] test-send inline image fetch failed:", error);
            warnings.push(`inline-image:${assetId} unavailable, sent without attachment`);
        }
    }
    if (inlineBytesTotal > MS_INLINE_IMAGE_WARN_BYTES) {
        warnings.push(
            `inline-images:oversize total ${inlineBytesTotal} bytes exceeds ${MS_INLINE_IMAGE_WARN_BYTES} budget`
        );
    }
    msLogRedacted("[studio-campaigns] test-send dispatched:", {
        campaign_id: campaignId,
        actor,
        seeds: targets.length,
    });
    const { transporter } = await getMsMailTransport();
    const fromName = (process.env.MAIL_FROM_NAME ?? "").trim();
    const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
    let delivered = true;
    for (const email of targets) {
        try {
            await transporter.sendMail({
                from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                to: email,
                subject: template.subject,
                text: textBody,
                html: resolved.html,
                attachments: inlineAttachments,
            });
            results.push({ email, ok: true, status: "sent", reason: null });
        } catch (error) {
            msLogRedacted("[studio-campaigns] test-send failed:", error);
            const message = error instanceof Error ? msScrubSecretsFromText(error.message) : "send failed";
            results.push({ email, ok: false, status: "failed", reason: message });
            delivered = false;
        }
    }
    results.sort((left, right) => clean.indexOf(left.email) - clean.indexOf(right.email));
    return { ok: delivered, status: delivered ? "sent" : "failed", reason: delivered ? null : "send-failed", results, warnings };
}
