"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { useMsSend } from "../hooks/useMsSend";
import { useMsTemplates } from "../hooks/useMsTemplates";

const EVENT_KEYS = [
    "initial_interview.graded",
    "final_interview.graded",
    "final_interview.invited",
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send tab — manual template send + binding-triggered send-now, both on the
 * real routes. Each submit records exactly one outbox row server-side; the
 * outcome panel shows only { ok, reason, status } (never PII). Applicant
 * lookup autofills the recipient but the field stays editable.
 */
export function SendTab() {
    const templates = useMsTemplates();
    const { data, isLoading, error, sendManual, sendNow, lookupApplicantEmail } = useMsSend();

    const [templateId, setTemplateId] = useState("");
    const [toEmail, setToEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [applicationId, setApplicationId] = useState("");
    const [lookupNote, setLookupNote] = useState<string | null>(null);
    const [sendMode, setSendMode] = useState<"event" | "binding">("event");
    const [eventKey, setEventKey] = useState<(typeof EVENT_KEYS)[number]>(EVENT_KEYS[2]);
    const [bindingId, setBindingId] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const handleLookup = async (): Promise<void> => {
        const id = applicationId.trim();
        if (!id) {
            setLookupNote("Enter an application id first.");
            return;
        }
        const email = await lookupApplicantEmail(id);
        if (email) {
            setToEmail(email);
            setLookupNote("Recipient filled from the applicant record.");
        } else {
            setLookupNote("No valid email found for that application id.");
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
        if (sendMode === "binding" && !bindingId.trim()) {
            setFormError("Enter a binding id, or switch to event-key mode.");
            return;
        }
        await sendNow({
            to_email: toEmail.trim(),
            ...(sendMode === "event" ? { event_key: eventKey } : { binding_id: bindingId.trim() }),
        });
    };

    return (
        <section aria-label="Send" className="flex min-h-0 flex-1 flex-col gap-4" data-testid="send-form">
            <div className="grid gap-3 xl:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <h2 className="text-sm font-semibold">Manual send</h2>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-template">
                            Template
                        </Label>
                        <NativeSelect
                            aria-label="Template"
                            disabled={templates.isLoading}
                            id="send-template"
                            value={templateId}
                            onChange={(event) => setTemplateId(event.target.value)}
                        >
                            <NativeSelectOption value="">
                                {templates.isLoading ? "Loading templates…" : "Select a template"}
                            </NativeSelectOption>
                            {(templates.data ?? []).map((row) => (
                                <NativeSelectOption
                                    key={String(row.id ?? row.template_key)}
                                    value={String(row.id ?? row.template_key)}
                                >
                                    {row.template_name} ({row.template_key})
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
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
                            <Button size="sm" variant="outline" onClick={() => void handleLookup()}>
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
                            Recipient
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
                    <Button
                        aria-label="Send manual email"
                        disabled={isLoading}
                        size="sm"
                        onClick={() => void handleManualSend()}
                    >
                        {isLoading ? "Sending…" : "Send email"}
                    </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    <h2 className="text-sm font-semibold">Send now (event dispatch)</h2>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-mode">
                            Dispatch by
                        </Label>
                        <NativeSelect
                            id="sendnow-mode"
                            value={sendMode}
                            onChange={(event) => setSendMode(event.target.value as "event" | "binding")}
                        >
                            <NativeSelectOption value="event">Event key</NativeSelectOption>
                            <NativeSelectOption value="binding">Binding id</NativeSelectOption>
                        </NativeSelect>
                    </div>
                    {sendMode === "event" ? (
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-event">
                                Event key
                            </Label>
                            <NativeSelect
                                id="sendnow-event"
                                value={eventKey}
                                onChange={(event) =>
                                    setEventKey(event.target.value as (typeof EVENT_KEYS)[number])
                                }
                            >
                                {EVENT_KEYS.map((key) => (
                                    <NativeSelectOption key={key} value={key}>
                                        {key}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="sendnow-binding">
                                Binding id
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
                    <Button
                        aria-label="Dispatch send now"
                        disabled={isLoading}
                        size="sm"
                        variant="outline"
                        onClick={() => void handleSendNow()}
                    >
                        {isLoading ? "Dispatching…" : "Dispatch"}
                    </Button>
                </div>
            </div>

            {formError ? (
                <p className="text-sm text-muted-foreground" data-testid="send-form-error" role="alert">
                    {formError}
                </p>
            ) : null}
            {error ? (
                <p className="text-sm text-muted-foreground" data-testid="send-error" role="alert">
                    {error}
                </p>
            ) : null}
            {data ? (
                <div
                    className="rounded-lg border bg-card p-4"
                    data-testid="send-outcome"
                    role="status"
                >
                    <p className="text-sm font-medium">
                        {data.ok ? "Recorded." : `Not sent — ${data.reason ?? "no reason given"}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {[data.status ? `status: ${data.status}` : null, data.idempotency_key ? `key: ${data.idempotency_key}` : null]
                            .filter(Boolean)
                            .join(" · ") || "no further details"}
                    </p>
                </div>
            ) : null}
        </section>
    );
}
