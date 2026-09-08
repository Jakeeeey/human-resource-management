"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { useMailTemplates } from "../hooks/useMailTemplates";
import {
    getApplicantEmail,
    listSendNowApplicants,
    postManualMailSend,
    type SendNowApplicant,
} from "../providers/mailSendNowService";
import { MailCombobox } from "./MailCombobox";
import { extractMailVarTokens } from "./MailComposePreview";
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
import { MailTemplateEditor } from "./MailTemplateEditor";
import type { MailTemplateEditorHandle } from "./MailTemplateEditor";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Manual Send composer (template picker + receiver + variable fill-in +
 * send-only customization + live preview, one click = one manual-send POST =
 * one outbox row). Template options are ACTIVE templates only; applicants reuse
 * the Send-now list shape (rows without application_id already dropped by the
 * provider). Customization is send-only: the template row is never patched.
 * Switching templates re-hydrates subject/body/vars, discarding unsent edits.
 * @returns The Image-1 compose shell (title + Load Template row, settings-left
 * editor-right split, bottom Send Now bar) with the Image-2 variables modal.
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
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [varsOpen, setVarsOpen] = useState(false);

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

    // Recipient autofill: selecting an applicant fills the email input from
    // the application record (stays editable; blank still falls back
    // server-side). Primitive dep avoids refiring on applicant-list reloads,
    // so typed-in edits survive; stale lookups drop via the request guard.
    const pickedApplicationId = picked?.application_id;
    useEffect(() => {
        if (pickedApplicationId === undefined || pickedApplicationId === null) {
            setToEmail("");
            return;
        }
        let cancelled = false;
        void getApplicantEmail(pickedApplicationId).then((email) => {
            if (!cancelled && email) setToEmail(email);
        });
        return () => {
            cancelled = true;
        };
    }, [pickedApplicationId]);

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

    const sendBlocked =
        sending || !picked || !templateId || emailError !== null || missingVars.length > 0;
    const varsTitle = pickedTemplateName
        ? `Template Variables: ${pickedTemplateName}`
        : "Template Variables";

    return (
        <div className="mx-auto grid w-full max-w-[1200px] gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid min-w-0 gap-1">
                    <h2 className="truncate text-lg font-semibold" title="Compose Email">
                        Compose Email
                    </h2>
                        {!pickedTemplateName && (
                            <p className="truncate text-sm text-muted-foreground" title="Pick an active template below to start.">
                                Pick an active template below to start.
                            </p>
                        )}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
                    {tokens.allowed.length > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={sending}
                            onClick={() => setVarsOpen(true)}
                        >
                            Variables
                        </Button>
                    )}
                    <MailCombobox
                        options={templateOptions}
                        value={templateId}
                        onValueChange={setTemplateId}
                        placeholder="Load Template"
                        disabled={sending}
                        className="w-56 max-w-full"
                    />
                </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
                <section
                    className="grid min-w-0 content-start gap-4 rounded-lg border border-border bg-card p-4"
                    aria-label="Email settings"
                >
                    <div className="grid min-w-0 gap-1.5">
                        <Label htmlFor="mail-manualsend-applicant">Receiver</Label>
                        <MailCombobox
                            options={applicantOptions}
                            value={pickedId}
                            onValueChange={setPickedId}
                            placeholder="Search applicants…"
                            disabled={sending}
                        />
                    </div>
                    <div className="grid min-w-0 gap-1.5">
                        <Label htmlFor="mail-manualsend-email">Recipient email</Label>
                        <Input
                            id="mail-manualsend-email"
                            type="email"
                            value={toEmail}
                            onChange={(e) => setToEmail(e.target.value)}
                            placeholder="Applicant email"
                            disabled={sending}
                            className="truncate"
                            title={toEmail ? toEmail : undefined}
                        />
                        {emailError && (
                            <p className="text-xs text-destructive" role="alert">
                                {emailError}
                            </p>
                        )}
                    </div>
                    {selectedTemplate && (
                        <div className="grid min-w-0 gap-1.5">
                            <Label htmlFor="mail-manualsend-subject">Subject</Label>
                            <Input
                                id="mail-manualsend-subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Email subject"
                                disabled={sending}
                                className="truncate"
                                title={subject ? subject : undefined}
                            />
                        </div>
                    )}
                </section>

                <section
                    className="flex min-h-[320px] flex-col rounded-lg border border-border bg-card p-4"
                    aria-label="Email body"
                >
                    {selectedTemplate ? (
                        <MailTemplateEditor ref={editorRef} value={bodyHtml} onChange={setBodyHtml} />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Select a template to start composing.
                        </p>
                    )}
                </section>
            </div>

            {missingVars.length > 0 && (
                <p className="text-sm text-destructive" role="alert">
                    Fill in the {missingVars.length === 1 ? "highlighted field" : `${missingVars.length} highlighted fields`} before
                    sending
                </p>
            )}

            <div className="border-t border-border pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
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
                        {sending ? "Sending…" : "Send Now"}
                    </Button>
                </div>
            </div>

            <Dialog open={varsOpen} onOpenChange={setVarsOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl p-0">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle className="truncate" title={varsTitle}>
                            {varsTitle}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
                        <div className="grid gap-3">
                            {tokens.allowed.map((name) => (
                                <div key={name} className="grid min-w-0 gap-1.5">
                                    <Label
                                        htmlFor={`mail-compose-var-${name}`}
                                        className="truncate font-mono text-xs text-muted-foreground"
                                        title={`{{${name}}}`}
                                    >
                                        {`{{${name}}}`}
                                    </Label>
                                    <Input
                                        id={`mail-compose-var-${name}`}
                                        value={vars[name] ?? ""}
                                        onChange={(e) => setVar(name, e.target.value)}
                                        placeholder={`{{${name}}}`}
                                        disabled={sending}
                                        className="truncate text-sm"
                                        title={`{{${name}}}`}
                                    />
                                </div>
                            ))}
                            {tokens.unknown.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
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
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setVarsOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-full sm:w-auto"
                            onClick={() => setVarsOpen(false)}
                        >
                            Populate & Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
