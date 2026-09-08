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
import { MailTemplateEditor, toFriendlyMailVarName } from "./MailTemplateEditor";
import type { MailTemplateEditorHandle } from "./MailTemplateEditor";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Port of the job-offer salutation rule (JobOfferModule salutationPrefix +
// surnameOf — ported, never imported, per the module-boundary ban): Mr. for
// Male, Mrs. for Female + Married, Ms. for other Female, null when unknown.
function mailSalutationPrefix(sex: unknown, civilStatus: unknown): string | null {
    if (sex === "Male") return "Mr.";
    if (sex === "Female") return civilStatus === "Married" ? "Mrs." : "Ms.";
    return null;
}

function mailSurnameOf(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const last = parts.length > 0 ? parts[parts.length - 1] : "";
    return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
}

// Example values shown as variable-input placeholders (display only —
// never submitted; the renderer still sends blank for unfilled tokens).
const MAIL_VAR_EXAMPLES: Record<string, string> = {
    applicant_name: "Juan Dela Cruz",
    candidate_name: "Juan Dela Cruz",
    salutation_name: "Mr. Dela Cruz",
    position: "Software Engineer",
    company_name: "Vertex Technologies Corporation",
    verdict: "Passed",
    result: "Passed",
    decision_date: "September 8, 2026",
    request_no: "REQ-2026-014",
    base_location: "Cebu City",
    department: "Engineering",
    division: "Operations",
    interview_date: "September 10, 2026",
    interview_time: "9:00 AM",
    venue: "Vertex HQ, Cebu City",
    contact_person: "Maria Santos",
    sender_name: "HR Recruitment",
};

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
    const [varsSnapshot, setVarsSnapshot] = useState<Record<string, string>>({});
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewBody, setPreviewBody] = useState("");
    const [applicantVitals, setApplicantVitals] = useState<{ sex: unknown; civil_status: unknown } | null>(null);

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

    // Salutation vitals: sex + civil status from the application record (same
    // read the job-offer form uses). Silent on failure — fields stay manual.
    const pickedApplicantId = picked?.applicant_id;
    useEffect(() => {
        if (pickedApplicantId === undefined || pickedApplicantId === null) {
            setApplicantVitals(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const res = await fetch(
                    `/api/hrm/applications/by-applicant?applicant_id=${pickedApplicantId}`
                );
                if (!res.ok || cancelled) return;
                const json = await res.json();
                const app = json?.data?.application;
                if (cancelled || !app || typeof app !== "object") return;
                const record = app as Record<string, unknown>;
                setApplicantVitals({ sex: record.sex, civil_status: record.civil_status });
            } catch {
                // Autofill is a convenience — the vars stay manual on failure.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [pickedApplicantId]);

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

    // Applicant-driven defaults for the tokens the record can answer: names
    // from the picked row, position from the application, salutation from the
    // vitals fetch. Everything else (verdict/dates/venue/…) stays manual.
    const autoVars = useMemo(() => {
        const filled: Record<string, string> = {};
        if (!picked) return filled;
        if (picked.full_name.trim().length > 0) {
            filled.applicant_name = picked.full_name;
            filled.candidate_name = picked.full_name;
        }
        if (picked.position_applied_for !== null && picked.position_applied_for.trim().length > 0) {
            filled.position = picked.position_applied_for;
        }
        const prefix = mailSalutationPrefix(applicantVitals?.sex, applicantVitals?.civil_status);
        if (prefix) {
            const surname = mailSurnameOf(picked.full_name);
            filled.salutation_name = surname ? `${prefix} ${surname}` : prefix;
        }
        return filled;
    }, [picked, applicantVitals]);

    // Autofill: fills live tokens that have a record value and no user value
    // yet. Absent-key check (not emptiness) so cleared fields stay cleared
    // while template-switch resets (vars = {}) re-fill.
    useEffect(() => {
        if (tokens.allowed.length === 0) return;
        const patch: Record<string, string> = {};
        for (const name of tokens.allowed) {
            if (name in vars) continue;
            const value = autoVars[name];
            if (value) patch[name] = value;
        }
        if (Object.keys(patch).length > 0) {
            setVars((prev) => ({ ...prev, ...patch }));
        }
    }, [tokens, autoVars, vars]);

    const emailMissing = toEmail.trim().length === 0;
    const emailError = emailMissing
        ? null
        : !EMAIL_PATTERN.test(toEmail.trim())
          ? "Enter a valid email address."
          : null;
    const showEmailRequired = emailMissing && (picked !== null || selectedTemplate !== null);

    const loading = templatesLoading || applicantsLoading;
    const loadError = templatesError ?? applicantsError;

    const setVar = (name: string, value: string) => {
        setVars((prev) => ({ ...prev, [name]: value }));
    };

    // Variables modal open/close: opening snapshots so Cancel can discard
    // in-modal edits; Save keeps them (inputs already write live state).
    const openVars = () => {
        setVarsSnapshot(vars);
        setVarsOpen(true);
    };
    const cancelVars = () => {
        setVars(varsSnapshot);
        setVarsOpen(false);
    };
    // Preview snapshot: captures the CLEAN body in the click handler (chip
    // spans serialized back to {{tokens}}) — never a ref read during render.
    const handlePreview = () => {
        setPreviewBody(editorRef.current?.getCleanHtml() ?? bodyHtml);
        setPreviewOpen(true);
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
        sending || !picked || !templateId || emailMissing || emailError !== null || missingVars.length > 0;

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
                            onClick={openVars}
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
                        {showEmailRequired && (
                            <p className="text-xs text-destructive" role="alert">
                                Recipient email is required.
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
                    className="flex max-h-[560px] min-h-[320px] flex-col rounded-lg border border-border bg-card p-4"
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
                    {missingVars.length === 1
                        ? "1 variable left unfilled — fill it in before sending"
                        : `${missingVars.length} variables left unfilled — fill them in before sending`}
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
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={!selectedTemplate || sending}
                        onClick={handlePreview}
                    >
                        Preview
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
                        <DialogTitle className="truncate" title="Template Variables">
                            Template Variables
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
                        <div className="grid gap-3">
                            {tokens.allowed.map((name) => {
                                const friendly = toFriendlyMailVarName(name);
                                return (
                                <div key={name} className="grid min-w-0 gap-1.5">
                                    <Label
                                        htmlFor={`mail-compose-var-${name}`}
                                        className="truncate text-xs text-muted-foreground"
                                        title={`{{${name}}}`}
                                    >
                                        {friendly}
                                    </Label>
                                    <Input
                                        id={`mail-compose-var-${name}`}
                                        value={vars[name] ?? ""}
                                        onChange={(e) => setVar(name, e.target.value)}
                                        placeholder={MAIL_VAR_EXAMPLES[name] ?? friendly}
                                        disabled={sending}
                                        className="truncate text-sm"
                                        title={friendly}
                                    />
                                </div>
                                );
                            })}
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
                            onClick={cancelVars}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-full sm:w-auto"
                            onClick={() => setVarsOpen(false)}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="w-[95vw] sm:max-w-[760px] max-h-[85vh] flex flex-col overflow-hidden rounded-2xl p-0">
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <DialogTitle className="truncate" title="Email preview">
                            Email preview
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-4">
                        <MailComposePreview
                            subject={subject}
                            bodyHtml={previewBody}
                            vars={sendVars}
                            applicantLabel={picked ? picked.full_name : null}
                        />
                    </div>
                    <DialogFooter className="flex-col gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setPreviewOpen(false)}
                        >
                            Close
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
