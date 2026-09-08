"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { mailVarAllowlist } from "../types/mail-template.schema";
import { renderMailTemplate } from "../utils/mailRenderer";
import { scrubClientHtml } from "../utils/mailScrub";

const ALLOWLIST = new Set<string>(mailVarAllowlist as readonly string[]);
const VAR_TOKEN = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export interface ExtractedMailVars {
    /** Allowlisted tokens in first-seen order (get inputs). */
    allowed: string[];
    /** Non-allowlisted tokens in first-seen order (warnings only, never inputs). */
    unknown: string[];
}

/**
 * Extracts every {{token}} from subject + body in first-seen order, split by
 * the frozen renderer allowlist (same token shape the renderer substitutes).
 * @param subject - Customized subject carrying {{tokens}}.
 * @param bodyHtml - Customized body HTML carrying {{tokens}}.
 * @returns Allowed names (inputs) + unknown names (read-only warnings).
 */
export function extractMailVarTokens(subject: string, bodyHtml: string): ExtractedMailVars {
    const allowed: string[] = [];
    const unknown: string[] = [];
    const seen = new Set<string>();
    for (const text of [subject, bodyHtml]) {
        if (typeof text !== "string" || text.indexOf("{{") === -1) continue;
        text.replace(VAR_TOKEN, (match: string, name: string) => {
            if (typeof name === "string" && name.length > 0 && !seen.has(name)) {
                seen.add(name);
                if (ALLOWLIST.has(name)) allowed.push(name);
                else unknown.push(name);
            }
            return match;
        });
    }
    return { allowed, unknown };
}

type MailPreviewMode = "light" | "dark" | "no-images";

const PREVIEW_MODES: { value: MailPreviewMode; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "no-images", label: "Images off" },
];

interface MailComposePreviewProps {
    subject: string;
    bodyHtml: string;
    vars: Record<string, string>;
    applicantLabel: string | null;
}

/**
 * Live preview card for the manual-send composer: renders the customized
 * subject/body through scrub-then-render (same order as the template editor
 * preview) with the filled vars, plus inline warning badges. Header names the
 * recipient (Customer.io preview-as-profile pattern); the Light/Dark/
 * Images-off control is chrome-only emulation and labeled as such — no
 * builder predicts Gmail/Outlook dark inversion. The light surface is forced
 * `color-scheme: light` on a white backdrop and inherits zero builder tokens.
 * @param subject - Customized subject with {{tokens}}.
 * @param bodyHtml - Customized body HTML with {{tokens}}.
 * @param vars - Filled per-send variable values.
 * @param applicantLabel - Recipient the preview renders as (null = nobody yet).
 * @returns The preview card (recipient header + mode control + body + warnings).
 */
export function MailComposePreview({
    subject,
    bodyHtml,
    vars,
    applicantLabel,
}: MailComposePreviewProps) {
    const [mode, setMode] = useState<MailPreviewMode>("light");
    const [announcement, setAnnouncement] = useState("");

    const preview = useMemo(() => {
        let scrubbed = "";
        try {
            scrubbed = bodyHtml ? scrubClientHtml(bodyHtml) : "";
        } catch {
            scrubbed = "";
        }
        const subjectRender = renderMailTemplate(subject, vars);
        const bodyRender = renderMailTemplate(scrubbed, vars);
        const seen = new Set<string>();
        const warnings = [...subjectRender.warnings, ...bodyRender.warnings].filter((w) =>
            seen.has(w) ? false : (seen.add(w), true),
        );
        return { subjectText: subjectRender.text, bodyHtml: bodyRender.text, warnings };
    }, [subject, bodyHtml, vars]);

    const unknownTokens = useMemo(
        () => extractMailVarTokens(subject, bodyHtml).unknown,
        [subject, bodyHtml],
    );

    const renderWarnings = useMemo(
        () => preview.warnings.filter((w) => !w.startsWith("unknown-var:")),
        [preview.warnings],
    );

    // Debounced polite status: one announcement per pause, never per-keystroke.
    useEffect(() => {
        const timer = setTimeout(() => {
            setAnnouncement(
                preview.subjectText || preview.bodyHtml
                    ? "Preview updated."
                    : "Nothing to preview yet."
            );
        }, 600);
        return () => clearTimeout(timer);
    }, [preview.subjectText, preview.bodyHtml]);

    const dark = mode === "dark";
    const imagesOff = mode === "no-images";

    return (
        <section
            className="grid content-start gap-3 rounded-lg border border-border bg-card p-4"
            aria-label="Email preview"
        >
            <div className="grid gap-1">
                <h3
                    className="truncate text-sm font-medium"
                    title={applicantLabel ? `Previewing as: ${applicantLabel}` : "Previewing as: nobody yet"}
                >
                    {applicantLabel ? `Previewing as: ${applicantLabel}` : "Previewing as: nobody yet"}
                </h3>
                <p className="sr-only" aria-live="polite">
                    {announcement}
                </p>
            </div>
            <div className="grid gap-1.5">
                <div
                    role="group"
                    aria-label="Preview display mode"
                    className="border-border bg-muted inline-flex w-fit items-center gap-0.5 rounded-md border p-0.5"
                >
                    {PREVIEW_MODES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setMode(option.value)}
                            aria-pressed={mode === option.value}
                            className={cn(
                                "rounded-sm px-2.5 py-1 text-xs font-medium focus-visible:ring-1 focus-visible:outline-hidden",
                                mode === option.value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground"
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    {dark
                        ? "Dark predicts authored dark styles only — not Gmail or Outlook."
                        : imagesOff
                          ? "Images-off hides pictures, like a client blocking remote images."
                          : "Light matches the default inbox render."}
                </p>
            </div>
            {unknownTokens.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {unknownTokens.map((name) => (
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
            {renderWarnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="alert">
                    {renderWarnings.map((warning) => (
                        <span
                            key={warning}
                            className="max-w-full truncate rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                            title={warning}
                        >
                            {warning}
                        </span>
                    ))}
                </div>
            )}
            <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">Subject</p>
                <p
                    className="truncate text-sm font-medium"
                    title={preview.subjectText ? preview.subjectText : undefined}
                >
                    {preview.subjectText || "—"}
                </p>
            </div>
            <div className="grid gap-1.5">
                <p className="text-xs text-muted-foreground">Body</p>
                {preview.bodyHtml ? (
                    <div
                        className={cn(
                            "rounded-md border border-border p-3 text-sm leading-relaxed",
                            imagesOff && "[&_img]:hidden"
                        )}
                        style={
                            dark
                                ? {
                                      colorScheme: "dark",
                                      backgroundColor: "#1b1b1f",
                                      color: "#e8e6e3",
                                  }
                                : {
                                      colorScheme: "light",
                                      backgroundColor: "#ffffff",
                                      color: "#1b1b1f",
                                  }
                        }
                        dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
            </div>
        </section>
    );
}
