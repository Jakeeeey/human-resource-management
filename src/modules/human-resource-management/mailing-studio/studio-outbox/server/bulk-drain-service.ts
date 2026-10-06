import { dFetch } from "@/modules/human-resource-management/mailing-studio/studio-bindings/utils/directus";
import {
    fetchActiveTemplate,
    getPhilippineTime,
    resolveTemplateBodyHtml,
    takeRateSlot,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/dispatch-service";
import {
    MS_RELAY_BATCH_SIZE,
    MS_RELAY_MAX_ATTEMPTS,
    backoffMinutesForAttempts,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/services/relay-service";
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
import { renderTemplate } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/template-render";
import {
    msAssertMailableHtml,
    msHasForbiddenMailHtml,
} from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-html-scrub";
import { mailHtmlToText } from "@/modules/human-resource-management/mailing-studio/studio-bindings/events/utils/ms-mail-text";
import { buildBulkUnsubscribeUrl } from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/unsubscribe-link";

export const MS_BULK_DRAIN_BATCH_SIZE = MS_RELAY_BATCH_SIZE;
export const MS_BULK_DAILY_CAP_DEFAULT = 5000;
export const MS_BULK_EXHAUSTED_ERROR = "bulk-exhausted";

const OUTBOX_COLLECTION = "/items/ms_outbox";
const CLAIMS_COLLECTION = "/items/ms_outbox_claims";
const CAMPAIGNS_COLLECTION = "/items/ms_campaigns";
const SUPPRESSIONS_COLLECTION = "/items/ms_suppressions";
const ALLOWANCE_COLLECTION = "/items/ms_dispatch_allowance";
const DRAIN_ACTOR = "bulk-drain";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkDrainRow {
    id: string | number;
    campaignId: string | number;
    toEmail: string;
    templateId: string | number;
    attempts: number;
}

export interface BulkDrainOptions {
    publicBaseUrl?: string;
}

export interface BulkDrainResult {
    claimed: number;
    sent: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
}

interface CampaignState {
    id: string | number;
    status: string;
    startedAt: string | null;
    totalCount: number;
}

interface AllowanceState {
    id: string | number | null;
    sentCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowUTC(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function philippineDateKey(): string {
    return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Manila" }).slice(0, 10);
}

function minutesFromNow(minutes: number): string {
    return new Date(Date.now() + minutes * 60_000).toLocaleString("sv-SE", {
        timeZone: "Asia/Manila",
    });
}

function parseDailyCap(): number {
    const raw = Number.parseInt(process.env.MAIL_BULK_DAILY_CAP ?? "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : MS_BULK_DAILY_CAP_DEFAULT;
}

function coerceAttempts(value: unknown): number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function toBulkDrainRow(raw: unknown): BulkDrainRow | null {
    if (!isRecord(raw)) return null;
    const id = raw.id;
    if (typeof id !== "string" && typeof id !== "number") return null;
    const campaignId = raw.campaign_id;
    if (typeof campaignId !== "string" && typeof campaignId !== "number") return null;
    const toEmail = raw.to_email;
    if (typeof toEmail !== "string") return null;
    const templateId = raw.template_id;
    if (typeof templateId !== "string" && typeof templateId !== "number") return null;
    return {
        id,
        campaignId,
        toEmail,
        templateId,
        attempts: coerceAttempts(raw.attempts),
    };
}

async function readDataArray(query: string): Promise<Record<string, unknown>[] | null> {
    try {
        const res = (await dFetch(query)) as { data?: unknown };
        if (!isRecord(res) || !Array.isArray(res.data)) return null;
        const rows: Record<string, unknown>[] = [];
        for (const entry of res.data) {
            if (isRecord(entry)) rows.push(entry);
        }
        return rows;
    } catch {
        return null;
    }
}

export async function listDueBulkRows(limit: number = MS_BULK_DRAIN_BATCH_SIZE): Promise<BulkDrainRow[]> {
    const bounded =
        Number.isInteger(limit) && limit > 0
            ? Math.min(limit, MS_BULK_DRAIN_BATCH_SIZE)
            : MS_BULK_DRAIN_BATCH_SIZE;
    const now = getPhilippineTime();
    const fields = "id,campaign_id,to_email,template_id,attempts,idempotency_key,event_key,next_attempt_at";
    const gates =
        `filter[published_at][_null]=true` +
        `&filter[attempts][_lt]=${MS_RELAY_MAX_ATTEMPTS}` +
        `&filter[_or][0][next_attempt_at][_null]=true` +
        `&filter[_or][1][next_attempt_at][_lte]=${encodeURIComponent(now)}`;
    const scoped =
        `${OUTBOX_COLLECTION}?fields=${fields}&${gates}` +
        `&filter[campaign_id][_nnull]=true&sort=next_attempt_at,id&limit=${bounded}`;
    let raw = await readDataArray(scoped);
    if (raw === null) {
        const fallback =
            `${OUTBOX_COLLECTION}?fields=${fields}&${gates}` +
            `&sort=next_attempt_at,id&limit=${bounded * 3}`;
        raw = await readDataArray(fallback);
    }
    if (raw === null) return [];
    const rows: BulkDrainRow[] = [];
    for (const entry of raw) {
        const row = toBulkDrainRow(entry);
        if (row !== null) rows.push(row);
        if (rows.length >= bounded) break;
    }
    return rows;
}

async function tryClaimBulkRow(id: string | number, expectedAttempts: number): Promise<boolean> {
    try {
        const res = (await dFetch(CLAIMS_COLLECTION, {
            method: "POST",
            body: JSON.stringify({
                outbox_id: id,
                attempt: expectedAttempts + 1,
                claimed_at: getPhilippineTime(),
            }),
        })) as { data?: unknown; errors?: unknown };
        if (isRecord(res) && !("errors" in res) && "data" in res) return true;
        msLogRedacted("[bulk-drain] claim lost (row left due):", res);
        return false;
    } catch (error) {
        msLogRedacted("[bulk-drain] claim failed (row left due):", error);
        return false;
    }
}

async function patchOutboxRow(id: string | number, patch: Record<string, unknown>): Promise<void> {
    try {
        await dFetch(`${OUTBOX_COLLECTION}/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    } catch (error) {
        msLogRedacted("[bulk-drain] row PATCH failed:", error);
    }
}

async function readCampaignState(id: string | number): Promise<CampaignState | null> {
    const rows = await readDataArray(
        `${CAMPAIGNS_COLLECTION}?filter[id][_eq]=${encodeURIComponent(String(id))}&fields=id,status,started_at,total_count&limit=1`
    );
    if (!rows || rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;
    const rowId = row.id;
    if (typeof rowId !== "string" && typeof rowId !== "number") return null;
    const status = row.status;
    if (typeof status !== "string") return null;
    const startedAt = row.started_at;
    const totalRaw = row.total_count;
    return {
        id: rowId,
        status,
        startedAt: typeof startedAt === "string" && startedAt !== "" ? startedAt : null,
        totalCount: typeof totalRaw === "number" && Number.isInteger(totalRaw) && totalRaw >= 0 ? totalRaw : 0,
    };
}

async function patchCampaign(id: string | number, patch: Record<string, unknown>): Promise<void> {
    try {
        await dFetch(`${CAMPAIGNS_COLLECTION}/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    } catch (error) {
        msLogRedacted("[bulk-drain] campaign PATCH failed:", error);
    }
}

async function isSuppressed(email: string): Promise<boolean | null> {
    try {
        const res = (await dFetch(
            `${SUPPRESSIONS_COLLECTION}?filter[email][_eq]=${encodeURIComponent(email)}&fields=id&limit=1`
        )) as { data?: unknown };
        if (!isRecord(res) || !Array.isArray(res.data)) return null;
        return res.data.length > 0;
    } catch (error) {
        msLogRedacted("[bulk-drain] suppression lookup failed:", error);
        return null;
    }
}

async function readAllowanceState(windowKey: string): Promise<AllowanceState | null> {
    const rows = await readDataArray(
        `${ALLOWANCE_COLLECTION}?filter[window_key][_eq]=${encodeURIComponent(windowKey)}&fields=id,sent_count&limit=1`
    );
    if (rows === null) return null;
    if (rows.length > 0) {
        const row = rows[0] as Record<string, unknown>;
        const rowId = row.id;
        const sentCount = row.sent_count;
        return {
            id: typeof rowId === "string" || typeof rowId === "number" ? rowId : null,
            sentCount:
                typeof sentCount === "number" && Number.isInteger(sentCount) && sentCount >= 0
                    ? sentCount
                    : 0,
        };
    }
    try {
        const created = (await dFetch(ALLOWANCE_COLLECTION, {
            method: "POST",
            body: JSON.stringify({
                window_key: windowKey,
                sent_count: 0,
                updated_at: getPhilippineTime(),
            }),
        })) as { data?: unknown };
        if (isRecord(created) && isRecord(created.data)) {
            const echoId = (created.data as Record<string, unknown>).id;
            return {
                id: typeof echoId === "string" || typeof echoId === "number" ? echoId : null,
                sentCount: 0,
            };
        }
    } catch (error) {
        msLogRedacted("[bulk-drain] allowance create failed:", error);
        return null;
    }
    const reread = await readDataArray(
        `${ALLOWANCE_COLLECTION}?filter[window_key][_eq]=${encodeURIComponent(windowKey)}&fields=id,sent_count&limit=1`
    );
    if (reread === null || reread.length === 0) return null;
    const row = reread[0] as Record<string, unknown>;
    const rowId = row.id;
    return {
        id: typeof rowId === "string" || typeof rowId === "number" ? rowId : null,
        sentCount: 0,
    };
}

async function patchAllowance(id: string | number, sentCount: number): Promise<void> {
    try {
        await dFetch(`${ALLOWANCE_COLLECTION}/${encodeURIComponent(String(id))}`, {
            method: "PATCH",
            body: JSON.stringify({ sent_count: sentCount, updated_at: getPhilippineTime() }),
        });
    } catch (error) {
        msLogRedacted("[bulk-drain] allowance PATCH failed:", error);
    }
}

async function syncCampaignProgress(campaignId: string | number): Promise<void> {
    const campaign = await readCampaignState(campaignId);
    if (!campaign) return;
    const rows = await readDataArray(
        `${OUTBOX_COLLECTION}?filter[campaign_id][_eq]=${encodeURIComponent(String(campaignId))}&fields=status,published_at&limit=-1`
    );
    if (!rows) return;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let unresolved = 0;
    for (const row of rows) {
        const published = row.published_at;
        if (published === null || published === undefined || published === "") unresolved += 1;
        const status = row.status;
        if (status === "sent") sent += 1;
        else if (status === "failed") failed += 1;
        else if (status === "skipped" || status === "dry_run") skipped += 1;
    }
    const patch: Record<string, unknown> = {
        sent_count: sent,
        failed_count: failed,
        skipped_count: skipped,
        updated_by: DRAIN_ACTOR,
    };
    if (campaign.status === "queued" && unresolved > 0) {
        patch.status = "sending";
        if (campaign.startedAt === null) patch.started_at = nowUTC();
    }
    if ((campaign.status === "queued" || campaign.status === "sending") && unresolved === 0) {
        const resolved = sent + failed + skipped;
        if (campaign.totalCount <= 0 || resolved >= campaign.totalCount) {
            patch.status = "sent";
            patch.finished_at = nowUTC();
        }
    }
    await patchCampaign(campaignId, patch);
}

export async function runBulkDrain(
    limit: number = MS_BULK_DRAIN_BATCH_SIZE,
    opts?: BulkDrainOptions
): Promise<BulkDrainResult> {
    const result: BulkDrainResult = { claimed: 0, sent: 0, failed: 0, skipped: 0, dryRun: false };
    try {
        const config = getMsMailConfigStatus();
        result.dryRun = config.dryRun;
        if (!config.dryRun && !config.configured) {
            msLogRedacted("[bulk-drain] transport unconfigured, rows left queued:", config.missing);
            return result;
        }
        const cap = parseDailyCap();
        const rows = await listDueBulkRows(limit);
        if (rows.length === 0) return result;
        const windowKey = philippineDateKey();
        let allowanceSent = 0;
        let allowanceId: string | number | null = null;
        if (!config.dryRun) {
            const allowance = await readAllowanceState(windowKey);
            if (allowance === null) return result;
            allowanceSent = allowance.sentCount;
            allowanceId = allowance.id;
        }
        const campaigns = new Map<string | number, CampaignState | null>();
        const affected = new Set<string | number>();
        for (const row of rows) {
            try {
                const now = getPhilippineTime();
                const email = row.toEmail.trim().toLowerCase();
                if (!EMAIL_PATTERN.test(email)) {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: row.toEmail,
                        template_id: row.templateId,
                        warnings: ["missing-or-invalid-recipient"],
                        error: null,
                        attempts: row.attempts,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                let campaign = campaigns.get(row.campaignId);
                if (campaign === undefined) {
                    campaign = await readCampaignState(row.campaignId);
                    campaigns.set(row.campaignId, campaign);
                }
                if (campaign === null) {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: email,
                        template_id: row.templateId,
                        warnings: ["campaign-missing"],
                        error: null,
                        attempts: row.attempts,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                if (campaign.status === "cancelled") {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: email,
                        template_id: row.templateId,
                        warnings: ["campaign-cancelled"],
                        error: null,
                        attempts: row.attempts,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                if (!config.dryRun && allowanceSent >= cap) break;
                if (!config.dryRun && !takeRateSlot(config.ratePerMinute)) break;
                const claimed = await tryClaimBulkRow(row.id, row.attempts);
                if (!claimed) continue;
                result.claimed += 1;
                const consumed = row.attempts + 1;
                const suppressed = await isSuppressed(email);
                if (suppressed === null) {
                    const backoff = backoffMinutesForAttempts(consumed);
                    await patchOutboxRow(row.id, {
                        status: "queued",
                        to_email: email,
                        template_id: row.templateId,
                        warnings: [],
                        error: "suppression-check-failed",
                        attempts: consumed,
                        next_attempt_at: backoff === null ? null : minutesFromNow(backoff),
                    });
                    continue;
                }
                if (suppressed) {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: email,
                        template_id: row.templateId,
                        warnings: ["suppressed"],
                        error: null,
                        sent_at: null,
                        attempts: consumed,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                const template = await fetchActiveTemplate(row.templateId);
                if (!template) {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: email,
                        template_id: row.templateId,
                        warnings: ["missing-or-inactive-template"],
                        error: null,
                        sent_at: null,
                        attempts: consumed,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                const resolvedBody = await resolveTemplateBodyHtml(template);
                const renderedSubject = renderTemplate(template.subject, { payload: {} });
                const renderedBody = renderTemplate(resolvedBody.html, { payload: {} });
                const warnings = [
                    ...resolvedBody.warnings,
                    ...renderedSubject.warnings,
                    ...renderedBody.warnings,
                ];
                const finalSubject = renderedSubject.html;
                const finalBody = renderedBody.html;
                const forbiddenReason = msAssertMailableHtml(finalBody);
                if (msHasForbiddenMailHtml(finalBody) || forbiddenReason) {
                    await patchOutboxRow(row.id, {
                        status: "skipped",
                        to_email: email,
                        template_id: template.id,
                        warnings: [...warnings, `forbidden-html:${forbiddenReason ?? "rejected"}`],
                        error: null,
                        sent_at: null,
                        rendered_subject: finalSubject,
                        rendered_body_html: finalBody,
                        attempts: consumed,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.skipped += 1;
                    continue;
                }
                const textBody = mailHtmlToText(finalBody);
                if (config.dryRun) {
                    await patchOutboxRow(row.id, {
                        status: "dry_run",
                        to_email: email,
                        template_id: template.id,
                        warnings,
                        error: null,
                        sent_at: null,
                        rendered_subject: finalSubject,
                        rendered_body_html: finalBody,
                        attempts: consumed,
                        published_at: now,
                    });
                    affected.add(row.campaignId);
                    result.sent += 1;
                    continue;
                }
                const headers: Record<string, string> = {};
                const unsubscribeUrl = buildBulkUnsubscribeUrl(email, opts?.publicBaseUrl);
                if (unsubscribeUrl === null) {
                    warnings.push("unsubscribe-link-unavailable");
                } else {
                    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
                    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
                }
                const inlineCids = msCidRefsInHtml(finalBody);
                const inlineAttachments: {
                    cid: string;
                    filename: string;
                    content: Buffer;
                    contentType: string;
                }[] = [];
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
                        msLogRedacted("[bulk-drain] inline image fetch failed:", error);
                        warnings.push(`inline-image:${assetId} unavailable, sent without attachment`);
                    }
                }
                if (inlineBytesTotal > MS_INLINE_IMAGE_WARN_BYTES) {
                    warnings.push(
                        `inline-images:oversize total ${inlineBytesTotal} bytes exceeds ${MS_INLINE_IMAGE_WARN_BYTES} budget`
                    );
                }
                let sendError: string | null = null;
                try {
                    const { transporter } = await getMsMailTransport();
                    const fromName = (process.env.MAIL_FROM_NAME ?? "").trim();
                    const fromEmail = (process.env.MAIL_FROM_EMAIL ?? "").trim();
                    await transporter.sendMail({
                        from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
                        to: email,
                        subject: finalSubject,
                        text: textBody,
                        html: finalBody,
                        headers,
                        attachments: inlineAttachments,
                    });
                } catch (error) {
                    msLogRedacted("[bulk-drain] send failed:", error);
                    sendError =
                        error instanceof Error ? msScrubSecretsFromText(error.message) : "send failed";
                }
                if (sendError) {
                    if (consumed >= MS_RELAY_MAX_ATTEMPTS) {
                        await patchOutboxRow(row.id, {
                            status: "failed",
                            to_email: email,
                            template_id: template.id,
                            warnings,
                            error: MS_BULK_EXHAUSTED_ERROR,
                            rendered_subject: finalSubject,
                            rendered_body_html: finalBody,
                            attempts: consumed,
                            published_at: now,
                        });
                        affected.add(row.campaignId);
                        result.failed += 1;
                    } else {
                        const backoff = backoffMinutesForAttempts(consumed);
                        await patchOutboxRow(row.id, {
                            status: "queued",
                            to_email: email,
                            template_id: template.id,
                            warnings,
                            error: sendError,
                            rendered_subject: finalSubject,
                            rendered_body_html: finalBody,
                            attempts: consumed,
                            next_attempt_at: backoff === null ? null : minutesFromNow(backoff),
                        });
                    }
                    continue;
                }
                await patchOutboxRow(row.id, {
                    status: "sent",
                    to_email: email,
                    template_id: template.id,
                    warnings,
                    error: null,
                    sent_at: now,
                    rendered_subject: finalSubject,
                    rendered_body_html: finalBody,
                    attempts: consumed,
                    published_at: now,
                });
                allowanceSent += 1;
                if (allowanceId !== null) await patchAllowance(allowanceId, allowanceSent);
                affected.add(row.campaignId);
                result.sent += 1;
            } catch (error) {
                msLogRedacted("[bulk-drain] row handling failed:", error);
            }
        }
        for (const campaignId of affected) {
            try {
                await syncCampaignProgress(campaignId);
            } catch (error) {
                msLogRedacted("[bulk-drain] campaign sync failed:", error);
            }
        }
    } catch (error) {
        msLogRedacted("[bulk-drain] sweep failed (never throw):", error);
    }
    return result;
}
