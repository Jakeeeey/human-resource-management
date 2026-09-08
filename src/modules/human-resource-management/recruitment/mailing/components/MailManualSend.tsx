"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { useMailTemplates } from "../hooks/useMailTemplates";
import {
    listSendNowApplicants,
    postManualMailSend,
    type SendNowApplicant,
} from "../providers/mailSendNowService";
import { MailCombobox } from "./MailCombobox";
import { MailComposePreview, extractMailVarTokens } from "./MailComposePreview";
import {
    MailConfirmDialog,
    MailConfirmDialogAction,
    MailConfirmDialogCancel,
    MailConfirmDialogContent,
    MailConfirmDialogDescription,
    MailConfirmDialogFooter,
    MailConfirmDialogHeader,
    MailConfirmDialogTitle,
} from "./MailConfirmDialog";
import { MailStatusBadge } from "./MailStatusBadge";
import { MailVarDocs } from "./MailHoverCard";
import { MailTemplateEditor, toFriendlyMailVarName } from "./MailTemplateEditor";
import type { MailTemplateEditorHandle } from "./MailTemplateEditor";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Manual Send composer (template picker + receiver + variable fill-in +
 * send-only customization + live preview, one click = one manual-send POST =
 * one outbox row). Template options are ACTIVE templates only; applicants reuse
 * the Send-now list shape (rows without application_id already dropped by the
 * provider). Customization is send-only: the template row is never patched.
 * Switching templates re-hydrates subject/body/vars, discarding unsent edits.
 * @returns The Gmail-native single column (sticky header, borderless To/Subject
 * rows, open body canvas, variables strip, toggle-only preview, sticky send bar).
 */
export function MailManualSend() {
    const { templates, loading: templatesLoading, error: templatesError, refresh: refreshTemplates } =
        useMailTemplates();

    const [applicants, setApplicants] = useState<SendNowApplicant[]>([]);
    const [applicantsLoading, setApplicantsLoading] = useState(true);
    const [applicantsError, setApplicantsError] = useState<string | null>(null);
    const [templateId, setTemplateId] = useState("");
    const [pickedId, setPickedId] = useState("");
    const [toEmail, setToEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [vars, setVars] = useState<Record<string, string>>({});
    const [sending, setSending] = useState(false);
    const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Body editor ref (page-level creation, same as MailTemplatePage): bodyHtml
    // state holds DISPLAY html (chip spans); consumers read CLEAN html
    // ({{tokens}}) via getCleanHtml() inside memos/handlers only.
    const editorRef = useRef<MailTemplateEditorHandle | null>(null);

    const loadApplicants = useCallback(() => {
        let cancelled = false;
        setApplicantsLoading(true);
        setApplicantsError(null);
        (async () => {
            const result = await listSendNowApplicants();
            if (cancelled) return;
            if (!result.success || !result.data) {
                setApplicantsError(result.message ?? "Failed to list applicants");
            } else {
                setApplicants(result.data);
            }
            setApplicantsLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => loadApplicants(), [loadApplicants]);

    const handleRefresh = useCallback(() => {
        void refreshTemplates();
        loadApplicants();
    }, [refreshTemplates, loadApplicants]);

    useEffect(() => {
        const handler = () => {
            handleRefresh();
        };
        window.addEventListener("mailing:refresh", handler);
        return () => window.removeEventListener("mailing:refresh", handler);
    }, [handleRefresh]);

    const templateOptions = useMemo(
        () =>
            templates
                .filter((row) => row.is_active)
                .map((row) => ({
                    value: String(row.id),
                    label: row.template_name,
                })),
        [templates]
    );

    const applicantOptions = useMemo(
        () =>
            applicants.map((row) => ({
                value: String(row.application_id),
                label: `${row.full_name}${row.position_applied_for ? ` — ${row.position_applied_for}` : ""}`,
            })),
        [applicants]
    );

    const picked = useMemo(
        () => applicants.find((row) => String(row.application_id) === pickedId) ?? null,
        [applicants, pickedId]
    );

    const pickedTemplateName = useMemo(
        () => templateOptions.find((opt) => opt.value === templateId)?.label ?? null,
        [templateOptions, templateId]
    );

    const selectedTemplate = useMemo(
        () => templates.find((row) => String(row.id) === templateId) ?? null,
        [templates, templateId]
    );

    const selectedSubject = selectedTemplate?.subject ?? "";
    const selectedBody = selectedTemplate?.body_html ?? "";

    // Template switch re-hydrates the whole compose state (unsent
    // customization is discarded with no dialog).
    useEffect(() => {
        setSubject(selectedSubject);
        setBodyHtml(selectedBody);
        setVars({});
    }, [templateId, selectedSubject, selectedBody]);

    // Var inputs derive from the LIVE customized text (first-seen order):
    // typing a new allowlisted {{token}} into subject/body reveals its input.
    // The body read is the CLEAN html (chip spans serialized back to
    // {{tokens}}); the display state alone would hide painted chips.
    const tokens = useMemo(() => {
        const cleanBody = editorRef.current?.getCleanHtml() ?? bodyHtml;
        return extractMailVarTokens(subject, cleanBody);
    }, [subject, bodyHtml, editorRef]);

    // Clean body for the preview card: same chip-serialization as the tokens
    // strip so the preview renders plain {{tokens}} (MailComposePreview
    // itself is untouched — it still receives plain body html).
    const previewBodyHtml = useMemo(
        () => editorRef.current?.getCleanHtml() ?? bodyHtml,
        [bodyHtml, editorRef]
    );

    // Trimmed, blank-dropped vars shared by the preview and the POST body.
    const sendVars = useMemo(() => {
        const clean: Record<string, string> = {};
        for (const [key, value] of Object.entries(vars)) {
            const trimmed = value.trim();
            if (trimmed.length > 0) clean[key] = trimmed;
        }
        return clean;
    }, [vars]);

    // Fill-guard: every live allowlisted token needs a filled value, else Send
    // stays blocked with Superhuman-style prompting copy.
    const missingVars = useMemo(
        () => tokens.allowed.filter((name) => !(name in sendVars)),
        [tokens, sendVars]
    );

    const emailError =
        toEmail.trim().length > 0 && !EMAIL_PATTERN.test(toEmail.trim())
            ? "Enter a valid email, or leave blank to use the application record."
            : null;

    const loading = templatesLoading || applicantsLoading;
    const loadError = templatesError ?? applicantsError;

    const setVar = (name: string, value: string) => {
        setVars((prev) => ({ ...prev, [name]: value }));
    };

    // Template chip detach: clears the selection, discarding unsent edits via
    // the same re-hydrate effect as a template switch.
    const detachTemplate = () => {
        setTemplateId("");
    };

    // Discard confirm: clears receiver + vars + customization back to the
    // template defaults (same reset lines as a successful send). The template
    // row is never touched.
    const discardDraft = () => {
        setPickedId("");
        setToEmail("");
        setVars({});
        setSubject(selectedSubject);
        setBodyHtml(selectedBody);
        setConfirmOpen(false);
    };

    const handleSend = async () => {
        if (!picked || !templateId || sending || emailError) return;
        setSending(true);
        try {
            const trimmedEmail = toEmail.trim();
            const trimmedSubject = subject.trim();
            // POST the CLEAN body (chip spans serialized back to {{tokens}});
            // the non-empty guard runs on the clean string.
            const cleanBody = editorRef.current?.getCleanHtml() ?? bodyHtml;
            const result = await postManualMailSend({
                template_id: templateId,
                application_id: picked.application_id,
                ...(trimmedEmail.length > 0 ? { to_email: trimmedEmail } : {}),
                ...(trimmedSubject.length > 0 ? { subject: trimmedSubject } : {}),
                ...(cleanBody.length > 0 ? { body_html: cleanBody } : {}),
                ...(Object.keys(sendVars).length > 0 ? { vars: sendVars } : {}),
            });
            if (!result.success) {
                toast.error(result.message ?? "Send failed.");
                return;
            }
            const outcome = result.data;
            if (outcome?.ok && outcome.status === "sent") {
                toast.success("Sent (logged to outbox).");
                setPickedId("");
                setToEmail("");
                setVars({});
                setSubject(selectedSubject);
                setBodyHtml(selectedBody);
            } else if (outcome?.ok && outcome.status === "dry_run") {
                toast.success("Dry run recorded (no email sent).");
                setPickedId("");
                setToEmail("");
                setVars({});
                setSubject(selectedSubject);
                setBodyHtml(selectedBody);
            } else if (outcome?.status === "skipped") {
                toast.error(`Skipped (${outcome.reason ?? "unknown"}).`);
            } else {
                toast.error(`Failed (${outcome?.reason ?? "unknown"}).`);
            }
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="grid gap-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="grid gap-3">
                <p className="text-sm text-destructive" role="alert">{loadError}</p>
                <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                        if (templatesError) void refreshTemplates();
                        if (applicantsError) {
                            setApplicantsLoading(true);
                            setApplicantsError(null);
                            void listSendNowApplicants().then((result) => {
                                if (!result.success || !result.data) {
                                    setApplicantsError(result.message ?? "Failed to list applicants");
                                } else {
                                    setApplicants(result.data);
                                }
                                setApplicantsLoading(false);
                            });
                        }
                    }}
                >
                    Retry
                </Button>
            </div>
        );
    }

    const applicantLabel = picked
        ? `${picked.full_name} (Application #${picked.application_id})`
        : null;
    const sendBlocked =
        sending || !picked || !templateId || emailError !== null || missingVars.length > 0;

    const editPane = (
        <div className="grid content-start">
            {!selectedTemplate && (
                <div className="grid gap-1 border-b border-border px-1 py-3">
                    <Label className="text-xs text-muted-foreground">Template</Label>
                    <MailCombobox
                        options={templateOptions}
                        value={templateId}
                        onValueChange={setTemplateId}
                        placeholder="Search templates…"
                        disabled={sending}
                        className="border-0 shadow-none"
                    />
                </div>
            )}
            <div className="grid gap-1 border-b border-border px-1 py-3">
                <Label className="text-xs text-muted-foreground">To</Label>
                <MailCombobox
                    options={applicantOptions}
                    value={pickedId}
                    onValueChange={setPickedId}
                    placeholder="Search applicants…"
                    disabled={sending}
                    className="border-0 shadow-none"
                />
                <Label htmlFor="mail-manualsend-email" className="text-xs text-muted-foreground">
                    Recipient email (optional)
                </Label>
                <Input
                    id="mail-manualsend-email"
                    type="email"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    placeholder="Blank = application record email"
                    disabled={sending}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                {emailError && (
                    <p className="text-xs text-destructive" role="alert">
                        {emailError}
                    </p>
                )}
            </div>
            {selectedTemplate && (
                <div className="grid gap-1 border-b border-border px-1 py-3">
                    <Label htmlFor="mail-manualsend-subject" className="text-xs text-muted-foreground">
                        Subject
                    </Label>
                    <Input
                        id="mail-manualsend-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Email subject"
                        disabled={sending}
                        className="truncate border-0 bg-transparent shadow-none focus-visible:ring-0"
                        title={subject ? subject : undefined}
                    />
                </div>
            )}
            {selectedTemplate && tokens.allowed.length > 0 && (
                <div className="grid gap-2 border-b border-border px-1 py-3">
                    <div className="flex flex-wrap gap-2">
                        {tokens.allowed.map((name) => (
                            <div key={name} className="flex items-center gap-2">
                                <Label htmlFor={`mail-compose-var-${name}`} className="text-xs text-muted-foreground">
                                    <MailVarDocs varName={name} friendlyName={toFriendlyMailVarName(name)}>
                                        <span
                                            className="inline-block cursor-help rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium"
                                            title={`{{${name}}}`}
                                        >
                                            {toFriendlyMailVarName(name)}
                                        </span>
                                    </MailVarDocs>
                                </Label>
                                <Input
                                    id={`mail-compose-var-${name}`}
                                    value={vars[name] ?? ""}
                                    onChange={(e) => setVar(name, e.target.value)}
                                    placeholder={`{{${name}}}`}
                                    disabled={sending}
                                    className="h-8 w-48 truncate text-sm"
                                    title={`{{${name}}}`}
                                />
                            </div>
                        ))}
                        {tokens.unknown.map((name) => (
                            <span
                                key={name}
                                className="inline-block max-w-full truncate rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium"
                                title={`{{${name}}} is not a known variable and sends as blank`}
                            >
                                {`{{${name}}}`}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {selectedTemplate && (
                <div className="grid gap-1 px-1 py-3">
                    <Label htmlFor="mail-manualsend-body" className="text-xs text-muted-foreground">
                        Body
                    </Label>
                    <MailTemplateEditor ref={editorRef} value={bodyHtml} onChange={setBodyHtml} />
                </div>
            )}
        </div>
    );

    const previewPane = selectedTemplate ? (
        <MailComposePreview
            subject={subject}
            bodyHtml={previewBodyHtml}
            vars={sendVars}
            applicantLabel={applicantLabel}
        />
    ) : (
        <div className="px-1 py-3">
            <p className="text-sm text-muted-foreground">
                Select a template to start composing.
            </p>
        </div>
    );

    return (
        <div className="mx-auto grid w-full max-w-[720px] gap-2">
            <div className="sticky top-0 z-30 w-full border-b border-border bg-background">
                <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid min-w-0 gap-1">
                        <h2 className="truncate text-lg font-semibold" title="New send">
                            New send
                        </h2>
                        {pickedTemplateName ? (
                            <p
                                className="truncate text-sm text-muted-foreground"
                                title={`Using ${pickedTemplateName} — edits affect this send only`}
                            >
                                Using {pickedTemplateName} — edits affect this send only{" "}
                                <button
                                    type="button"
                                    onClick={detachTemplate}
                                    disabled={sending}
                                    className="text-primary underline underline-offset-4 focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                                >
                                    Change
                                </button>
                            </p>
                        ) : (
                            <p className="truncate text-sm text-muted-foreground" title="Pick an active template below to start.">
                                Pick an active template below to start.
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <MailStatusBadge tone="info">Manual send</MailStatusBadge>
                    </div>
                </div>
            </div>

            <div className="px-1 py-1">
                <div
                    role="group"
                    aria-label="Composer view"
                    className="border-border bg-muted inline-flex w-fit items-center gap-0.5 rounded-md border p-0.5"
                >
                    {(["edit", "preview"] as const).map((view) => (
                        <button
                            key={view}
                            type="button"
                            onClick={() => setMobileView(view)}
                            aria-pressed={mobileView === view}
                            className={
                                mobileView === view
                                    ? "bg-background text-foreground rounded-sm px-3 py-1 text-xs font-medium shadow-sm focus-visible:ring-1 focus-visible:outline-hidden"
                                    : "text-muted-foreground rounded-sm px-3 py-1 text-xs font-medium focus-visible:ring-1 focus-visible:outline-hidden"
                            }
                        >
                            {view === "edit" ? "Edit" : "Preview"}
                        </button>
                    ))}
                </div>
            </div>

            {mobileView === "edit" ? editPane : previewPane}

            {missingVars.length > 0 && (
                <p className="text-sm text-destructive" role="alert">
                    Fill in the {missingVars.length === 1 ? "highlighted field" : `${missingVars.length} highlighted fields`} before
                    sending — we will flag anything left empty.
                </p>
            )}

            <div className="sticky bottom-0 z-10 border-t border-border bg-background pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [min-height:44px]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={sending}
                        onClick={() => setConfirmOpen(true)}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        disabled={sendBlocked}
                        onClick={() => void handleSend()}
                    >
                        {sending ? "Sending…" : "Send"}
                    </Button>
                </div>
            </div>

            <MailConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <MailConfirmDialogContent>
                    <MailConfirmDialogHeader>
                        <MailConfirmDialogTitle>Discard this send?</MailConfirmDialogTitle>
                        <MailConfirmDialogDescription>
                            The receiver, filled variables, and unsent edits will be
                            cleared. The template stays unchanged.
                        </MailConfirmDialogDescription>
                    </MailConfirmDialogHeader>
                    <MailConfirmDialogFooter>
                        <MailConfirmDialogCancel>Keep editing</MailConfirmDialogCancel>
                        <MailConfirmDialogAction onClick={discardDraft}>
                            Discard send
                        </MailConfirmDialogAction>
                    </MailConfirmDialogFooter>
                </MailConfirmDialogContent>
            </MailConfirmDialog>
        </div>
    );
}
