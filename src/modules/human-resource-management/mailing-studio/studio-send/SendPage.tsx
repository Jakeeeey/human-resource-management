"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Loader2, MailOpen, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { MsCombobox } from "./components/MsCombobox";
import { useMsBindings } from "./hooks/useMsBindings";
import { useMsCatalog } from "./hooks/useMsCatalog";
import { useMsSend } from "./hooks/useMsSend";
import { useMsTemplates } from "./hooks/useMsTemplates";
import { msGet } from "./providers/msApi";
import { renderTemplate } from "./utils/template-render";
import { parseJsonDocument } from "./utils/ms-variables";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PREVIEW_DEBOUNCE_MS = 250;

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

function bindingIsEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
}

function bindingNumericId(value: unknown): number {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function schemaPropertyType(schema: unknown, name: string): string | null {
    const doc = parseJsonDocument(schema);
    if (doc !== null && typeof doc === "object" && !Array.isArray(doc)) {
        const properties = (doc as Record<string, unknown>)["properties"];
        if (properties !== null && typeof properties === "object" && !Array.isArray(properties)) {
            const entry = (properties as Record<string, unknown>)[name];
            if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
                const typeValue = (entry as Record<string, unknown>)["type"];
                if (typeof typeValue === "string" && typeValue.trim() !== "") {
                    return typeValue.trim();
                }
            }
        }
    }
    return null;
}

function examplePlaceholder(example: unknown, name: string): string | undefined {
    const doc = parseJsonDocument(example);
    if (doc !== null && typeof doc === "object" && !Array.isArray(doc)) {
        const value = (doc as Record<string, unknown>)[name];
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
            return String(value);
        }
    }
    return undefined;
}

interface MailMode {
    readonly dryRun: boolean;
    readonly degraded: boolean;
}

interface HealthAnswer {
    readonly dryRun?: unknown;
    readonly degraded?: unknown;
}

export function SendPage() {
    const templates = useMsTemplates();
    const catalog = useMsCatalog();
    const bindings = useMsBindings();
    const { data, isLoading, error, sendManual } = useMsSend();

    const [templateId, setTemplateId] = useState("");
    const [toEmail, setToEmail] = useState("");
    const [values, setValues] = useState<Record<string, string>>({});
    const [debouncedValues, setDebouncedValues] = useState<Record<string, string>>({});
    const [variablesOpen, setVariablesOpen] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [mailMode, setMailMode] = useState<MailMode | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedValues(values);
        }, PREVIEW_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [values]);

    const updateValue = (token: string, next: string): void => {
        setValues((prev) => ({ ...prev, [token]: next }));
    };

    const handleTemplateChange = (next: string): void => {
        setTemplateId(next);
        setValues({});
        setDebouncedValues({});
    };

    const templateOptions = useMemo(() => {
        return (templates.data ?? []).map((row) => ({
            value: String(row.id ?? row.template_key),
            label: `${row.template_name} — ${row.template_key}`,
        }));
    }, [templates.data]);

    const selectedTemplate = useMemo(() => {
        return (
            (templates.data ?? []).find(
                (row) => String(row.id ?? row.template_key) === templateId,
            ) ?? null
        );
    }, [templates.data, templateId]);

    const templateVariables = useMemo(() => {
        const raw = selectedTemplate?.variables;
        if (!Array.isArray(raw)) return [];
        return [...new Set(raw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))].sort();
    }, [selectedTemplate]);

    const boundBinding = useMemo(() => {
        if (!selectedTemplate) return null;
        const key = String(selectedTemplate.id ?? templateId);
        if (key === "") return null;
        const matches = (bindings.data ?? []).filter((row) => String(row.template_id) === key);
        if (matches.length === 0) return null;
        return [...matches].sort((a, b) => {
            const enabledA = bindingIsEnabled(a.is_enabled) ? 0 : 1;
            const enabledB = bindingIsEnabled(b.is_enabled) ? 0 : 1;
            if (enabledA !== enabledB) return enabledA - enabledB;
            return bindingNumericId(a.id) - bindingNumericId(b.id);
        })[0] ?? null;
    }, [bindings.data, selectedTemplate, templateId]);

    const boundEventRow = useMemo(() => {
        if (!boundBinding) return null;
        const key = String(boundBinding.event_key_id);
        return (catalog.data ?? []).find((row) => String(row.id) === key) ?? null;
    }, [boundBinding, catalog.data]);

    const eventContextCopy = boundEventRow
        ? `Variables checked against ${boundEventRow.event_key}.`
        : "No binding — variables cannot be type-checked.";

    const filledCount = templateVariables.filter((name) => (values[name] ?? "").trim() !== "").length;

    const emptyCount = templateVariables.length - filledCount;

    const sampleFor = (name: string): string | undefined => {
        if (!boundEventRow) return undefined;
        return examplePlaceholder(boundEventRow.payload_example, name);
    };

    const typeFor = (name: string): string | null => {
        if (!boundEventRow) return null;
        return schemaPropertyType(boundEventRow.payload_schema, name);
    };

    const previewPayload = useMemo(() => {
        return Object.fromEntries(templateVariables.map((name) => [name, debouncedValues[name] ?? ""]));
    }, [templateVariables, debouncedValues]);

    const renderedSubject = useMemo(() => {
        return renderTemplate(selectedTemplate?.subject ?? "", { payload: previewPayload });
    }, [selectedTemplate, previewPayload]);

    const renderedBody = useMemo(() => {
        return renderTemplate(selectedTemplate?.body_html ?? "", { payload: previewPayload });
    }, [selectedTemplate, previewPayload]);

    const previewWarnings = useMemo(() => {
        return [...new Set([...renderedSubject.warnings, ...renderedBody.warnings])];
    }, [renderedSubject, renderedBody]);

    const sendPayload = useMemo(() => {
        return Object.fromEntries(templateVariables.map((name) => [name, values[name] ?? ""]));
    }, [templateVariables, values]);

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

    const canSend = templateId !== "" && toEmail.trim() !== "" && !isLoading;

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
        const rendered = renderTemplate(selectedTemplate?.subject ?? "", { payload: sendPayload });
        const renderedBodyNow = renderTemplate(selectedTemplate?.body_html ?? "", { payload: sendPayload });
        const subject = rendered.html;
        const bodyHtml = renderedBodyNow.html;
        await sendManual({
            template_id: templateId,
            to_email: toEmail.trim(),
            ...(subject.trim() ? { subject } : {}),
            ...(bodyHtml.trim() ? { body_html: bodyHtml } : {}),
        });
    };

    const handleReset = (): void => {
        setTemplateId("");
        setToEmail("");
        setValues({});
        setDebouncedValues({});
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
                        <p className="text-sm text-muted-foreground">Pick a template, fill in its variables, preview, then send.</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-11 md:min-h-0" size="sm" variant="outline" onClick={handleReset}>
                        Reset form
                    </Button>
                </div>
            </header>
            <p className="text-xs text-muted-foreground" role="status">
                {mailModeCopy}
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
                <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
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
                            onValueChange={handleTemplateChange}
                        />
                        {templateId !== "" ? (
                            <p className="min-w-0 truncate text-[11px] leading-snug text-muted-foreground" role="status" title={eventContextCopy}>
                                {eventContextCopy}
                            </p>
                        ) : null}
                    </div>
                    {selectedTemplate ? (
                        templateVariables.length > 0 ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Variables ({templateVariables.length})
                                    </span>
                                    <span className="text-[11px] tabular-nums text-muted-foreground" role="status">
                                        {filledCount} of {templateVariables.length} filled
                                    </span>
                                </div>
                                <Button
                                    aria-label={filledCount === templateVariables.length ? "Review variables" : "Fill in variables"}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => setVariablesOpen(true)}
                                >
                                    <ListChecks className="h-4 w-4" />
                                    {filledCount === templateVariables.length ? "Review variables" : "Fill in variables"}
                                </Button>
                                {emptyCount > 0 ? (
                                    <p className="text-[11px] leading-snug text-amber-600 dark:text-amber-400" role="status">
                                        {emptyCount} {emptyCount === 1 ? "variable is" : "variables are"} still empty and will render blank.
                                    </p>
                                ) : null}
                                <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
                                    <DialogContent className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[700px]">
                                        <DialogHeader className="px-6 pt-6 text-left">
                                            <DialogTitle className="line-clamp-1" title={`Variables (${templateVariables.length})`}>
                                                Variables ({templateVariables.length})
                                            </DialogTitle>
                                            <DialogDescription>
                                                {filledCount} of {templateVariables.length} filled — blanks render empty.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                {templateVariables.map((name) => {
                                                    const typeLabel = typeFor(name);
                                                    const labelText = typeLabel ? `${name} · ${typeLabel}` : name;
                                                    return (
                                                        <div className="flex flex-col gap-0.5" key={name}>
                                                            <Label className="min-w-0 truncate text-[11px] font-medium text-muted-foreground" htmlFor={`send-var-${name}`} title={labelText}>
                                                                {labelText}
                                                            </Label>
                                                            <Input
                                                                className="h-8 text-xs"
                                                                id={`send-var-${name}`}
                                                                placeholder={sampleFor(name)}
                                                                value={values[name] ?? ""}
                                                                onChange={(event) => updateValue(name, event.target.value)}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <DialogFooter className="flex-row justify-end border-t bg-muted/20 px-6 py-4">
                                            <DialogClose asChild>
                                                <Button className="min-h-11 md:min-h-0" size="sm" type="button" variant="outline">
                                                    Done
                                                </Button>
                                            </DialogClose>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground" role="status">
                                This template has no variables.
                            </p>
                        )
                    ) : null}
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
                    <div>
                        <Button
                            className="min-h-11 md:min-h-0"
                            disabled={!canSend}
                            size="sm"
                            onClick={() => void handleManualSend()}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Send email
                        </Button>
                    </div>
                </div>

                <div className="hidden lg:block">
                    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border bg-card p-4">
                        {selectedTemplate ? (
                            <>
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="min-w-0 max-w-60 flex-1 truncate text-xs font-medium" title={selectedTemplate.template_name}>
                                        {selectedTemplate.template_name}
                                    </span>
                                    {previewWarnings.length > 0 ? (
                                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400" role="status" title={previewWarnings.join(", ")}>
                                            {previewWarnings.length} {previewWarnings.length === 1 ? "token" : "tokens"} unresolved
                                        </span>
                                    ) : null}
                                </div>
                                <div>
                                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                        Subject
                                    </span>
                                    <p className="min-w-0 truncate text-sm font-medium" title={selectedTemplate.subject}>
                                        {renderedSubject.html}
                                    </p>
                                </div>
                                <div className="overflow-hidden rounded-lg border">
                                    <iframe
                                        sandbox=""
                                        srcDoc={renderedBody.html}
                                        style={{ border: 0, display: "block", height: 420, width: "100%" }}
                                        title="Rendered email body"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-8 text-center">
                                <MailOpen className="h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">Pick a template to preview the rendered email.</p>
                            </div>
                        )}
                    </div>
                </div>
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
