"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MailOpen, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { MsCombobox } from "./components/MsCombobox";
import { useMsCatalog } from "./hooks/useMsCatalog";
import { useMsSend } from "./hooks/useMsSend";
import { useMsTemplates } from "./hooks/useMsTemplates";
import { msGet } from "./providers/msApi";
import { classifyTokens, extractPayloadKeys } from "./utils/ms-variables";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendMode = "event" | "binding";

function catalogRowIsActive(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

const SEND_ERROR_COPY: Record<string, string> = {
    "send-failed":
        "Couldn't reach the mail provider — nothing was sent. Retry or check provider settings.",
    "rate-capped": "Too many sends in the last minute — wait a moment, then retry.",
    skipped: "Send skipped — the recipient or template was not usable.",
    "binding-lookup-failed": "Couldn't read the send configuration — retry.",
    "no-enabled-binding": "No enabled binding exists for sending — hook one up in Bindings first.",
    "invalid-args": "Send request was invalid — retry.",
    "internal-error": "Something went wrong while sending — retry.",
};

function stripMachineCode(message: string): string {
    const stripped = message.replace(/^[A-Z][A-Z0-9_]+:\s*/, "").trim();
    return stripped === "" ? message.trim() : stripped;
}

function humaniseSendError(message: string): string {
    const key = message.trim();
    const direct = SEND_ERROR_COPY[key];
    if (direct) return direct;
    const stripped = stripMachineCode(key);
    const mapped = SEND_ERROR_COPY[stripped];
    if (mapped) return mapped;
    if (stripped !== "") return stripped;
    return "Something went wrong — please try again.";
}

function sendFailureCopy(reason: string | undefined): string {
    if (typeof reason !== "string") return "No reason given.";
    const key = reason.trim();
    if (key === "") return "No reason given.";
    const direct = SEND_ERROR_COPY[key];
    if (direct) return direct;
    const stripped = stripMachineCode(key);
    const mapped = SEND_ERROR_COPY[stripped];
    if (mapped) return mapped;
    if (stripped !== "") return stripped;
    return "Send failed — retry or check provider settings.";
}

interface MailMode {
    readonly dryRun: boolean;
    readonly degraded: boolean;
}

interface HealthAnswer {
    readonly dryRun?: unknown;
    readonly degraded?: unknown;
}

/**
 * Send tab — manual template send + binding-triggered send-now, both on the
 * real routes. The event picker is sourced from the event_catalog (same D4
 * contract as the bindings form) — never a hardcoded key list — so dispatch
 * can reach every registered key and none that was deliberately excluded.
 * Each submit records exactly one outbox row server-side; the outcome panel
 * shows only { ok, reason, status } (never PII). Applicant lookup autofills
 * the recipient but the field stays editable. The Tokens section classifies
 * the chosen template's compiled `variables` against the chosen event's
 * provided keys (§7.7) so unmapped tokens are visible before sending, and
 * the send-mode line states HONESTLY whether this surface delivers live
 * email (MAIL_DRY_RUN off) or records dry runs — read from the health
 * route, never assumed.
 */
export function SendPage() {
    const templates = useMsTemplates();
    const catalog = useMsCatalog(true);
    const { data, isLoading, error, sendManual, sendNow, lookupApplicantEmail } = useMsSend();

    const [templateId, setTemplateId] = useState("");
    const [toEmail, setToEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [applicationId, setApplicationId] = useState("");
    const [lookupNote, setLookupNote] = useState<string | null>(null);
    const [sendMode, setSendMode] = useState<SendMode>("event");
    const [eventKey, setEventKey] = useState("");
    const [bindingId, setBindingId] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [mailMode, setMailMode] = useState<MailMode | null>(null);
    const [lookupBusy, setLookupBusy] = useState(false);

    useEffect(() => {
        let live = true;
        msGet<HealthAnswer>(`/studio-bindings/events/health`)
            .then((answer) => {
                if (!live) return;
                setMailMode({
                    dryRun: answer?.dryRun !== false,
                    degraded: answer?.degraded === true,
                });
            })
            .catch(() => {
                if (live) setMailMode({ dryRun: true, degraded: true });
            });
        return () => {
            live = false;
        };
    }, []);

    const eventOptions = useMemo(() => {
        return (catalog.data ?? [])
            .filter((row) => catalogRowIsActive(row.is_active))
            .map((row) => ({
                value: row.event_key,
                label: `${row.event_key} — ${row.label}${row.module ? ` · ${row.module}` : ""}`,
            }))
            .sort((a, b) => a.value.localeCompare(b.value));
    }, [catalog.data]);
    const resolvedEventKey = eventKey !== "" ? eventKey : (eventOptions[0]?.value ?? "");

    const templateOptions = useMemo(() => {
        return (templates.data ?? []).map((row) => ({
            value: String(row.id ?? row.template_key),
            label: `${row.template_name} (${row.template_key})`,
        }));
    }, [templates.data]);

    const selectedTemplate = useMemo(() => {
        return (
            (templates.data ?? []).find(
                (row) => String(row.id ?? row.template_key) === templateId,
            ) ?? null
        );
    }, [templates.data, templateId]);

    const resolvedEventRow = useMemo(() => {
        return (
            (catalog.data ?? []).find((row) => row.event_key === resolvedEventKey) ?? null
        );
    }, [catalog.data, resolvedEventKey]);

    const providedKeys = useMemo(() => {
        if (!resolvedEventRow) return [];
        return extractPayloadKeys(
            resolvedEventRow.payload_schema,
            resolvedEventRow.payload_example,
        );
    }, [resolvedEventRow]);

    const tokenGroups = useMemo(() => {
        return classifyTokens(selectedTemplate?.variables ?? [], providedKeys);
    }, [selectedTemplate, providedKeys]);

    const outcomeDetails = data
        ? [data.status ? `status: ${data.status}` : null, data.idempotency_key ? `key: ${data.idempotency_key}` : null]
            .filter(Boolean)
            .join(" · ") || "no further details"
        : "";

    const mailModeCopy = mailMode === null
        ? "Checking send mode…"
        : mailMode.dryRun
          ? "Dry-run mode — sends are recorded, nothing is emailed."
          : mailMode.degraded
            ? "Live send — emails are delivered. The mail provider is unreachable right now, so sends will fail and land as failed rows."
            : "Live send — emails are delivered.";

    const handleLookup = async (): Promise<void> => {
        const id = applicationId.trim();
        if (!id) {
            setLookupNote("Enter an application id first.");
            return;
        }
        setLookupBusy(true);
        try {
            const email = await lookupApplicantEmail(id);
            if (email) {
                setToEmail(email);
                setLookupNote("Recipient filled from the applicant record.");
            } else {
                setLookupNote("No valid email found for that application id.");
            }
        } finally {
            setLookupBusy(false);
        }
    };

    const handleManualSend = async (): Promise<void> => {
        setFormError(null);
        if (!templateId) {
            setFormError("Pick a template first.");
            return;
        }
        if (!EMAIL_PATTERN.test(toEmail.trim())) {
            setFormError("Recipient email must be valid.");
            return;
        }
        await sendManual({
            template_id: templateId,
            to_email: toEmail.trim(),
            ...(subject.trim() ? { subject: subject.trim() } : {}),
            ...(bodyHtml.trim() ? { body_html: bodyHtml } : {}),
        });
    };

    const handleSendNow = async (): Promise<void> => {
        setFormError(null);
        if (!EMAIL_PATTERN.test(toEmail.trim())) {
            setFormError("Recipient email must be valid.");
            return;
        }
        if (sendMode === "event" && !resolvedEventKey) {
            setFormError("Pick an event key first — register one in the catalog when the list is empty.");
            return;
        }
        if (sendMode === "binding" && !bindingId.trim()) {
            setFormError("Enter a binding id, or switch to event-key mode.");
            return;
        }
        await sendNow({
            to_email: toEmail.trim(),
            ...(sendMode === "event" ? { event_key: resolvedEventKey } : { binding_id: bindingId.trim() }),
        });
    };

    const handleReset = (): void => {
        setTemplateId("");
        setToEmail("");
        setSubject("");
        setBodyHtml("");
        setApplicationId("");
        setLookupNote(null);
        setEventKey("");
        setBindingId("");
        setFormError(null);
    };

    return (
        <section aria-label="Send" className="flex min-h-0 flex-1 flex-col gap-4" data-testid="send-form">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Send className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold tracking-tight">Send</h1>
                        <p className="text-sm text-muted-foreground">Compose and fire a one-off email, or exercise an event-triggered send.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" onClick={handleReset}>
                        Reset form
                    </Button>
                </div>
            </header>
            <div className="grid gap-3 xl:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <h2 className="text-sm font-semibold">Manual send</h2>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-template">
                            Template <span className="text-destructive">*</span>
                        </Label>
                        <MsCombobox
                            ariaLabel="Template"
                            disabled={templates.isLoading}
                            emptyText="No templates found."
                            id="send-template"
                            options={templateOptions}
                            placeholder={templates.isLoading ? "Loading templates…" : "Select a template"}
                            searchPlaceholder="Search templates…"
                            value={templateId}
                            onValueChange={setTemplateId}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-application">
                            Applicant lookup (optional autofill)
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                className="h-8 text-xs"
                                id="send-application"
                                placeholder="Application id"
                                value={applicationId}
                                onChange={(event) => setApplicationId(event.target.value)}
                            />
                            <Button className="min-h-11 md:min-h-0" disabled={lookupBusy} size="sm" variant="outline" onClick={() => void handleLookup()}>
                                {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Fill
                            </Button>
                        </div>
                        {lookupNote ? (
                            <p className="text-xs text-muted-foreground" role="status">
                                {lookupNote}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-to">
                            Recipient <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            className="h-8 text-xs"
                            id="send-to"
                            inputMode="email"
                            placeholder="name@example.com"
                            value={toEmail}
                            onChange={(event) => setToEmail(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-subject">
                            Subject override (optional, send-only)
                        </Label>
                        <Input
                            className="h-8 text-xs"
                            id="send-subject"
                            value={subject}
                            onChange={(event) => setSubject(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-body">
                            HTML override (optional, send-only)
                        </Label>
                        <Textarea
                            className="min-h-24 text-xs"
                            id="send-body"
                            value={bodyHtml}
                            onChange={(event) => setBodyHtml(event.target.value)}
                        />
                    </div>
                    <div>
                        <Button
                            className="min-h-11 md:min-h-0"
                            disabled={isLoading}
                            size="sm"
                            onClick={() => void handleManualSend()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Send email
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <h2 className="text-sm font-semibold">Send now (event dispatch)</h2>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-mode">
                            Dispatch by
                        </Label>
                        <Select value={sendMode} onValueChange={(next) => setSendMode(next as SendMode)}>
                            <SelectTrigger className="h-8 w-full text-xs" id="sendnow-mode" size="sm">
                                <SelectValue placeholder="Dispatch by" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                <SelectItem value="event">Event key</SelectItem>
                                <SelectItem value="binding">Binding id</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {sendMode === "event" ? (
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-event">
                                Event key <span className="text-destructive">*</span>
                            </Label>
                            <MsCombobox
                                disabled={catalog.isLoading || eventOptions.length === 0}
                                emptyText="No active event keys."
                                id="sendnow-event"
                                options={eventOptions}
                                placeholder={catalog.isLoading ? "Loading event keys…" : "Select an event key"}
                                searchPlaceholder="Search event keys…"
                                value={resolvedEventKey}
                                onValueChange={setEventKey}
                            />
                            {catalog.error ? (
                                <p className="text-[11px] leading-snug text-destructive" role="alert">
                                    Catalog failed to load: {humaniseSendError(catalog.error)}
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-binding">
                                Binding id <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                className="h-8 text-xs"
                                id="sendnow-binding"
                                placeholder="Binding id"
                                value={bindingId}
                                onChange={(event) => setBindingId(event.target.value)}
                            />
                        </div>
                    )}
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Uses the same recipient field as manual send. One click dispatches once —
                        every click records a fresh outbox row.
                    </p>
                    <div>
                        <Button
                            aria-label="Dispatch send now"
                            className="min-h-11 md:min-h-0"
                            disabled={isLoading}
                            size="sm"
                            variant="outline"
                            onClick={() => void handleSendNow()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Dispatch
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border bg-card p-4" data-testid="send-tokens">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">Tokens &amp; send mode</h2>
                </div>
                <p className="text-xs text-muted-foreground" role="status">
                    {mailModeCopy}
                </p>
                {selectedTemplate ? (
                    <>
                        <p className="min-w-0 text-xs text-muted-foreground">
                            <span className="block max-w-full truncate font-medium text-foreground" title={selectedTemplate.template_name}>
                                {selectedTemplate.template_name}
                            </span>
                            <span className="block max-w-full truncate font-mono" title={sendMode === "event" && resolvedEventKey ? resolvedEventKey : "no event selected"}>
                                {sendMode === "event" && resolvedEventKey
                                    ? resolvedEventKey
                                    : "no event selected"}
                            </span>
                            <span>
                                Provided tokens resolve from the event payload; unmapped
                                tokens render empty to the recipient.
                            </span>
                        </p>
                        {tokenGroups.provided.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                    Provided ({tokenGroups.provided.length})
                                </span>
                                <ul className="flex flex-wrap gap-1">
                                    {tokenGroups.provided.map((token) => (
                                        <li
                                            className="max-w-48 truncate rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                                            key={token}
                                            title={`{{${token}}} resolves from this event`}
                                        >
                                            {`{{${token}}}`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {tokenGroups.unmapped.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-destructive">
                                    Unmapped ({tokenGroups.unmapped.length})
                                </span>
                                <ul className="flex flex-wrap gap-1">
                                    {tokenGroups.unmapped.map((token) => (
                                        <li
                                            className="max-w-48 truncate rounded border border-destructive/40 px-1.5 py-0.5 font-mono text-[11px] text-destructive"
                                            key={token}
                                            title={`{{${token}}} is not sent by this event — renders empty`}
                                        >
                                            {`{{${token}}}`}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {tokenGroups.provided.length === 0 && tokenGroups.unmapped.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No {"{{tokens}}"} in this template — nothing to map.
                            </p>
                        ) : null}
                        <div>
                            <Button
                                aria-label={`Preview in designer: ${selectedTemplate.template_name}`}
                                className="min-h-11 md:min-h-0"
                                size="sm"
                                variant="outline"
                                asChild
                            >
                                <Link
                                    href={`/hrm/mailing-studio/studio-templates/${encodeURIComponent(selectedTemplate.template_key)}/design`}
                                >
                                    Preview in designer
                                </Link>
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <MailOpen className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Pick a template above to see its tokens.</p>
                        <p className="text-xs text-muted-foreground">Tokens are checked against the chosen event, with a preview link.</p>
                    </div>
                )}
            </div>

            {formError ? (
                <p className="text-sm text-destructive" data-testid="send-form-error" role="alert">
                    {formError}
                </p>
            ) : null}
            {error ? (
                <p className="text-sm text-destructive" data-testid="send-error" role="alert">
                    {humaniseSendError(error)}
                </p>
            ) : null}
            {data ? (
                <div
                    className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4"
                    data-testid="send-outcome"
                    role="status"
                >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge
                            className={data.ok
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "border-destructive/40 bg-destructive/10 text-destructive"}
                            variant="outline"
                        >
                            {data.ok ? "Recorded" : "Not sent"}
                        </Badge>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium" title={data.ok ? "Recorded." : sendFailureCopy(data.reason)}>
                            {data.ok ? "Recorded." : sendFailureCopy(data.reason)}
                        </p>
                    </div>
                    <p className="min-w-0 truncate text-xs text-muted-foreground" title={outcomeDetails}>
                        {data.status ? (
                            <span>
                                status: {data.status}
                            </span>
                        ) : null}
                        {data.status && data.idempotency_key ? <span> · </span> : null}
                        {data.idempotency_key ? (
                            <span className="font-mono" title={data.idempotency_key}>
                                {data.idempotency_key}
                            </span>
                        ) : null}
                        {!data.status && !data.idempotency_key ? "no further details" : null}
                    </p>
                </div>
            ) : null}
        </section>
    );
}
