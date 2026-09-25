"use client";

import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";

import { mailVarAllowlist } from "../types/mail-template.schema";
import type { MailTemplateEditorHandle } from "../components/MailTemplateEditor";
import { renderMailTemplate } from "../utils/mailRenderer";
import { scrubClientHtml } from "../utils/mailScrub";
import { mailHtmlToText } from "../utils/mailText";
import type { MailTemplateRow } from "../providers/mailTemplateService";

interface UseMailTemplateFormOptions {
    template: MailTemplateRow | null;
    saving: boolean;
    editorRef: RefObject<MailTemplateEditorHandle | null>;
    onSave: (
        input: {
            template_key: string;
            template_name: string;
            subject: string;
            body_html: string;
            body_text: string;
            is_active: boolean;
        },
        id?: string | number,
    ) => Promise<{ ok: boolean; message?: string }>;
}

// Human copy for dry-run probe failure reasons (machine codes stay in
// the outbox row only — never in toast copy).
const DRY_RUN_REASON_COPY: Record<string, string> = {
    "send-failed": "Couldn't reach the mail provider — nothing was sent.",
    "template-missing": "The template could not be found — nothing was sent.",
    "render-failed": "The template could not be rendered — nothing was sent.",
};

function dryRunFailureCopy(reason: string | undefined): string {
    if (reason) {
        const trimmed = reason.trim();
        const hit = DRY_RUN_REASON_COPY[trimmed] ?? DRY_RUN_REASON_COPY[trimmed.toLowerCase()];
        if (hit) return hit;
    }
    return "Dry-run probe failed. Please try again later.";
}

export interface MailTemplateFieldErrors {
    templateKey: string | null;
    templateName: string | null;
    subject: string | null;
    body: string | null;
}

const EMPTY_FIELD_ERRORS: MailTemplateFieldErrors = {
    templateKey: null,
    templateName: null,
    subject: null,
    body: null,
};

// Preview sample vars (Appendix Renderer row): allowlisted blanks render
// `________________` cosmetically at the UI layer only — never in storage.
const SAMPLE_VARS = Object.fromEntries(mailVarAllowlist.map((name) => [name, "________________"]));

/**
 * Shared template form logic extracted byte-for-byte from MailTemplateDialog
 * (validation toasts, scrub-before-save, auto body_text, preview warnings,
 * dry-run readiness). No logic changes, no new validation rules.
 * @param options - Template row (null = create), saving flag, save helper.
 * @returns Form state + preview + save/dry-run handlers.
 */
export function useMailTemplateForm({ template, saving, editorRef, onSave }: UseMailTemplateFormOptions) {
    const [templateKey, setTemplateKey] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [testing, setTesting] = useState(false);
    const [dryRunReady, setDryRunReady] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<MailTemplateFieldErrors>(EMPTY_FIELD_ERRORS);

    useEffect(() => {
        setTemplateKey(template?.template_key ?? "");
        setTemplateName(template?.template_name ?? "");
        setSubject(template?.subject ?? "");
        setBodyHtml(template?.body_html ?? "");
        setIsActive(template?.is_active ?? true);
        setDryRunReady(false);
    }, [template]);

    // Preview runs on the SCRUBBED html + sample vars; unknown {{var}}
    // warnings from renderMailTemplate render inline (never stored here).
    const preview = useMemo(() => {
        let scrubbed = "";
        try {
            // Serialize chip spans back to {{tokens}} first: bodyHtml state
            // holds display labels, which scrub would otherwise unwrap as text.
            const previewHtml = editorRef.current?.getCleanHtml() ?? bodyHtml;
            scrubbed = previewHtml ? scrubClientHtml(previewHtml) : "";
        } catch {
            scrubbed = "";
        }
        const subjectRender = renderMailTemplate(subject, SAMPLE_VARS);
        const bodyRender = renderMailTemplate(scrubbed, SAMPLE_VARS, { boldVars: true });
        const seen = new Set<string>();
        const warnings = [...subjectRender.warnings, ...bodyRender.warnings].filter((w) =>
            seen.has(w) ? false : (seen.add(w), true),
        );
        return { subjectText: subjectRender.text, bodyText: bodyRender.text, warnings };
    }, [subject, bodyHtml, editorRef]);

    const buildPayload = () => {
        const nextErrors: MailTemplateFieldErrors = { ...EMPTY_FIELD_ERRORS };
        if (!templateKey.trim()) {
            nextErrors.templateKey = "Template key is required.";
        }
        if (!templateName.trim()) {
            nextErrors.templateName = "Template name is required.";
        }
        if (!subject.trim()) {
            nextErrors.subject = "Subject is required.";
        }
        let scrubbed = "";
        let bodyError: string | null = null;
        try {
            // Chip pills are editor-only chrome: serialize them back to
            // {{tokens}} first so storage/scrub/dispatch see plain variables.
            const editorHtml = editorRef.current?.getCleanHtml() ?? bodyHtml;
            scrubbed = scrubClientHtml(editorHtml);
        } catch {
            bodyError = "Editor content is unavailable. Please try again.";
        }
        if (!bodyError) {
            if (!scrubbed.trim()) {
                bodyError = "Body is required.";
            } else if (!mailHtmlToText(scrubbed).trim()) {
                bodyError = "Body has no readable text.";
            }
        }
        nextErrors.body = bodyError;
        const failed =
            nextErrors.templateKey !== null ||
            nextErrors.templateName !== null ||
            nextErrors.subject !== null ||
            nextErrors.body !== null;
        if (failed) {
            setFieldErrors(nextErrors);
            if (nextErrors.templateKey) toast.error(nextErrors.templateKey);
            else if (nextErrors.templateName) toast.error(nextErrors.templateName);
            else if (nextErrors.subject) toast.error(nextErrors.subject);
            else if (nextErrors.body) toast.error(nextErrors.body);
            return null;
        }
        setFieldErrors({ ...EMPTY_FIELD_ERRORS });
        // Save path: editor HTML → client scrub → auto-generate body_text.
        const body_text = mailHtmlToText(scrubbed);
        return {
            template_key: templateKey.trim(),
            template_name: templateName.trim(),
            subject: subject.trim(),
            body_html: scrubbed,
            body_text,
            is_active: isActive,
        };
    };

    const handleSave = async () => {
        const payload = buildPayload();
        if (!payload) return false;
        const result = await onSave(payload, template?.id);
        if (!result.ok) {
            toast.error(result.message ?? "Save failed.");
            return false;
        }
        toast.success(template ? "Template updated." : "Template created.");
        return true;
    };

    // DRY_RUN test-send: routes through the normal save, then records ONE
    // `dry_run` probe row via POST /api/hrm/mailing/test-send (save alone
    // writes zero outbox rows — this POST is what makes the click visible in
    // the Outbox viewer). Never touches the transporter: nothing is emailed.
    const handleDryRunTestSend = async () => {
        setTesting(true);
        try {
            const saved = await handleSave();
            if (!saved) return;
            const key = templateKey.trim();
            let recorded = false;
            try {
                const res = await fetch("/api/hrm/mailing/test-send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ template_key: key }),
                });
                const body = (await res.json().catch(() => null)) as {
                    success?: boolean;
                    data?: { ok?: boolean; reason?: string };
                } | null;
                recorded = res.ok && body?.success === true && body?.data?.ok === true;
                if (!recorded && body?.data?.reason) {
                    toast.error(dryRunFailureCopy(body.data.reason));
                    return;
                }
            } catch {
                // Network/parse failure below — generic toast, no PII.
            }
            if (!recorded) {
                toast.error("Dry-run probe failed. Please try again later.");
                return;
            }
            setDryRunReady(true);
            toast.success("Dry-run recorded — see the Outbox (All statuses).");
        } finally {
            setTesting(false);
        }
    };

    // Subject is plain text (no chips): field buttons always insert into
    // the body editor, falling back to append when it is unavailable.
    const insertVar = (name: string) => {
        const token = `{{${name}}}`;
        try {
            if (editorRef.current?.insertToken(token)) return;
        } catch {
            // Fall through to append when the editor is unavailable.
        }
        setBodyHtml((prev) => `${prev} {{${name}}}`);
    };

    const busy = saving || testing;

    const clearFieldError = (key: keyof MailTemplateFieldErrors) => {
        setFieldErrors((prev) => (prev[key] === null ? prev : { ...prev, [key]: null }));
    };

    return {
        templateKey,
        setTemplateKey: (value: string) => {
            clearFieldError("templateKey");
            setTemplateKey(value);
        },
        templateName,
        setTemplateName: (value: string) => {
            clearFieldError("templateName");
            setTemplateName(value);
        },
        subject,
        setSubject: (value: string) => {
            clearFieldError("subject");
            setSubject(value);
        },
        bodyHtml,
        setBodyHtml: (value: string) => {
            clearFieldError("body");
            setBodyHtml(value);
        },
        isActive,
        setIsActive,
        testing,
        dryRunReady,
        preview,
        fieldErrors,
        buildPayload,
        handleSave,
        handleDryRunTestSend,
        insertVar,
        busy,
    };
}
