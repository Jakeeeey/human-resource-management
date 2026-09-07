"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    subjectInputRef: RefObject<HTMLInputElement | null>;
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
export function useMailTemplateForm({ template, saving, editorRef, subjectInputRef, onSave }: UseMailTemplateFormOptions) {
    const [templateKey, setTemplateKey] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [subject, setSubject] = useState("");
    const [bodyHtml, setBodyHtml] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [testing, setTesting] = useState(false);
    const [dryRunReady, setDryRunReady] = useState(false);
    const lastFieldRef = useRef<"subject" | "body">("body");

    const noteFieldFocus = (field: "subject" | "body") => {
        lastFieldRef.current = field;
    };

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
        const bodyRender = renderMailTemplate(scrubbed, SAMPLE_VARS);
        const seen = new Set<string>();
        const warnings = [...subjectRender.warnings, ...bodyRender.warnings].filter((w) =>
            seen.has(w) ? false : (seen.add(w), true),
        );
        return { subjectText: subjectRender.text, bodyText: bodyRender.text, warnings };
    }, [subject, bodyHtml, editorRef]);

    const buildPayload = () => {
        if (!templateKey.trim()) {
            toast.error("Template key is required.");
            return null;
        }
        if (!templateName.trim()) {
            toast.error("Template name is required.");
            return null;
        }
        if (!subject.trim()) {
            toast.error("Subject is required.");
            return null;
        }
        let scrubbed: string;
        try {
            // Chip pills are editor-only chrome: serialize them back to
            // {{tokens}} first so storage/scrub/dispatch see plain variables.
            const editorHtml = editorRef.current?.getCleanHtml() ?? bodyHtml;
            scrubbed = scrubClientHtml(editorHtml);
        } catch {
            toast.error("Editor content is unavailable. Please try again.");
            return null;
        }
        if (!scrubbed.trim()) {
            toast.error("Body is required.");
            return null;
        }
        // Save path: editor HTML → client scrub → auto-generate body_text.
        const body_text = mailHtmlToText(scrubbed);
        if (!body_text.trim()) {
            toast.error("Body has no readable text.");
            return null;
        }
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
                    toast.error(`Dry-run probe failed: ${body.data.reason}.`);
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

    const insertVar = (name: string) => {
        const token = `{{${name}}}`;
        if (lastFieldRef.current === "subject" && subjectInputRef.current) {
            const el = subjectInputRef.current;
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            setSubject(`${el.value.slice(0, start)}${token}${el.value.slice(end)}`);
            const caret = start + token.length;
            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(caret, caret);
            });
            return;
        }
        try {
            if (editorRef.current?.insertToken(token)) return;
        } catch {
            // Fall through to append when the editor is unavailable.
        }
        setBodyHtml((prev) => `${prev} {{${name}}}`);
    };

    const busy = saving || testing;

    return {
        templateKey,
        setTemplateKey,
        templateName,
        setTemplateName,
        subject,
        setSubject,
        bodyHtml,
        setBodyHtml,
        isActive,
        setIsActive,
        testing,
        dryRunReady,
        preview,
        buildPayload,
        handleSave,
        handleDryRunTestSend,
        insertVar,
        noteFieldFocus,
        busy,
    };
}
