"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

import { mailVarAllowlist } from "../types/mail-template.schema";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as React.ElementType;

// Email-safe toolbar (mailing-module Appendix Editor row — copied from
// memo-creation/components/MemoCreationDialog.tsx:492-505). Exactly the
// allowed groups: headers 1-2, bold/italic/underline/strike, ordered/bullet
// lists, link, clean. NO colors/fonts/align/images/video/formulas.
const MAIL_TOOLBAR = [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "clean"],
];

// Formats lock (same row): blocks keyboard/paste insertion of anything
// outside the toolbar groups (image/video/headers-beyond-2). "var-chip" joins
// the list because Quill drops embed blots missing from it — the lock's intent
// is untouched: no toolbar button, keyboard shortcut, or paste matcher can
// produce a chip; only insertToken() (programmatic insertEmbed) creates one.
const MAIL_FORMATS = ["header", "bold", "italic", "underline", "strike", "list", "link", "var-chip"];

const VAR_TOKEN_PATTERN = /\{\{(\w+)\}\}/g;
const VAR_NAME_PATTERN = /^\w+$/;

/**
 * Friendly chip label for an allowlisted var: underscores → spaces with a
 * leading capital ("applicant_name" → "Applicant name"). The inserted token
 * stays the exact `{{snake_case}}` string.
 */
export function toFriendlyMailVarName(name: string): string {
    return name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const VAR_ALLOWLIST = new Set<string>(mailVarAllowlist as readonly string[]);

/** Minimal structural typing for the lazily-imported Quill class (SSR-safe: no static import). */
interface QuillDeltaConstructor {
    new (): { insert: (op: unknown) => unknown };
}
interface QuillClipboard {
    addMatcher: (selector: string, matcher: (node: unknown, delta: unknown) => unknown) => void;
}
interface QuillStatic {
    import: (path: string) => unknown;
    register: (path: string, target: unknown, overwrite?: boolean) => void;
}
interface ParchmentEmbedBase {
    new (...args: never[]): object;
    create: (value?: unknown) => HTMLElement;
}
interface VarChipModuleInstance {
    clipboard: QuillClipboard;
}

/**
 * Registers the var-chip embed blot + its clipboard matcher on a lazily-loaded
 * Quill class. Idempotent (overwrite flag) so StrictMode remounts are safe.
 */
function registerVarChip(Quill: QuillStatic): void {
    const EmbedBase = Quill.import("blots/embed") as unknown as ParchmentEmbedBase;
    const Delta = Quill.import("delta") as unknown as QuillDeltaConstructor;

    class VarChip extends EmbedBase {
        static blotName = "var-chip";
        static tagName = "span";
        static className = "ql-var-chip";

        static create(value?: unknown): HTMLElement {
            const node = super.create(value);
            const record = value as Partial<{ var: string; label: string }> | null;
            const name = typeof record?.var === "string" ? record.var : "";
            const label = typeof record?.label === "string" && record.label ? record.label : name;
            // Class applied manually: Parchment uses static className for
            // querying, not for stamping new nodes.
            node.classList.add("ql-var-chip");
            node.setAttribute("data-var", name);
            node.textContent = label;
            return node;
        }

        static value(node: HTMLElement): { var: string; label: string } {
            return {
                var: node.getAttribute("data-var") ?? "",
                label: node.textContent ?? "",
            };
        }
    }

    Quill.register("blots/var-chip", VarChip, true);
    Quill.register(
        "modules/var-chip",
        // Quill instantiates modules with `new`, so this MUST be a constructible
        // `function` — an arrow function throws "ModuleClass is not a constructor".
        function (this: unknown, instance: VarChipModuleInstance) {
            // Round-trip guard: without this, setContents/value updates degrade
            // stored chip spans to plain label text and the {{token}} is lost.
            instance.clipboard.addMatcher("span.ql-var-chip", (node, delta) => {
                const el = node as HTMLElement;
                const name = el.getAttribute?.("data-var") ?? "";
                if (!VAR_NAME_PATTERN.test(name)) return delta;
                return new Delta().insert({
                    "var-chip": { var: name, label: el.textContent ?? name },
                });
            });
        },
        true,
    );
}

/** Renders allowlisted {{tokens}} as chip spans for the editor's initial paint. */
function tokensToChipSpans(html: string): string {
    if (typeof html !== "string" || html.indexOf("{{") === -1) return html;
    return html.replace(VAR_TOKEN_PATTERN, (match, name: string) => {
        if (!VAR_ALLOWLIST.has(name)) return match;
        return `<span class="ql-var-chip" data-var="${name}">${toFriendlyMailVarName(name)}</span>`;
    });
}

interface MailTemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

/** Minimal insert API: returns true when the token landed at the cursor. */
export interface MailTemplateEditorHandle {
    insertToken: (token: string) => boolean;
    /** Editor HTML with chip spans serialized back to {{tokens}}. Null when unavailable. */
    getCleanHtml: () => string | null;
}

interface QuillInstance {
    focus: () => void;
    getSelection: () => { index: number; length: number } | null;
    insertText: (index: number, text: string, source: string) => void;
    insertEmbed: (index: number, type: string, value: { var: string; label: string }, source: string) => void;
    setSelection: (index: number, length: number, source: string) => void;
    root: HTMLElement;
}

/**
 * Client-only rich-text editor for mail templates.
 * @param value - Current editor HTML.
 * @param onChange - Called with the new HTML on edit.
 * @param placeholder - Empty-state hint.
 * @returns The snow-themed editor (SSR-disabled via dynamic import).
 */
export const MailTemplateEditor = forwardRef<MailTemplateEditorHandle, MailTemplateEditorProps>(
    function MailTemplateEditor({ value, onChange, placeholder }, ref) {
        const quillRef = useRef<{ getEditor?: () => QuillInstance | null } | null>(null);
        const [quillReady, setQuillReady] = useState(false);
        const [chipsOn, setChipsOn] = useState(false);
        const chipsOnRef = useRef(false);

        // Quill class loads client-side only: a static import would execute it
        // during SSR and crash on `document`. Editor renders after registration.
        // If registration ever fails, the plain editor still renders (chips off:
        // no conversion, inserts fall back to appended {{tokens}}).
        useEffect(() => {
            let cancelled = false;
            void import("react-quill-new").then((mod) => {
                if (cancelled) return;
                const holder = mod as unknown as { Quill?: QuillStatic; default?: { Quill?: QuillStatic } };
                const Quill = holder.Quill ?? holder.default?.Quill;
                if (!Quill) {
                    if (!cancelled) setQuillReady(true);
                    return;
                }
                try {
                    registerVarChip(Quill);
                } catch {
                    if (!cancelled) setQuillReady(true);
                    return;
                }
                if (cancelled) return;
                chipsOnRef.current = true;
                setChipsOn(true);
                setQuillReady(true);
            });
            return () => {
                cancelled = true;
            };
        }, []);

        // Display transform only: state keeps chip spans after the first paint,
        // so this is a no-op on every keystroke and converts on template load
        // plus freshly typed {{tokens}}.
        const displayValue = useMemo(() => (chipsOn ? tokensToChipSpans(value) : value), [value, chipsOn]);

        // Focus-then-insert only: no selection-restore machinery. False when
        // the editor is unmounted or has no selection (caller appends then).
        useImperativeHandle(
            ref,
            () => ({
                insertToken: (token: string) => {
                    try {
                        if (!chipsOnRef.current) return false;
                        const name = token.replace(/^\{\{|\}\}$/g, "");
                        if (!VAR_ALLOWLIST.has(name)) return false;
                        const editor = quillRef.current?.getEditor?.();
                        if (!editor) return false;
                        editor.focus();
                        const range = editor.getSelection();
                        if (!range) return false;
                        editor.insertEmbed(range.index, "var-chip", { var: name, label: toFriendlyMailVarName(name) }, "user");
                        editor.setSelection(range.index + 1, 0, "user");
                        return true;
                    } catch {
                        return false;
                    }
                },
                getCleanHtml: () => {
                    try {
                        const editor = quillRef.current?.getEditor?.();
                        const root = editor?.root;
                        if (!root || typeof document === "undefined") return null;
                        // Serialize on a clone: chip pills are editor-only chrome;
                        // storage/scrub/dispatch see plain {{tokens}} (Appendix
                        // Scrub row untouched — spans would merely unwrap there).
                        const clone = root.cloneNode(true) as HTMLElement;
                        clone.querySelectorAll("span.ql-var-chip").forEach((el) => {
                            const name = el.getAttribute("data-var") ?? "";
                            el.replaceWith(document.createTextNode(name ? `{{${name}}}` : (el.textContent ?? "")));
                        });
                        return clone.innerHTML;
                    } catch {
                        return null;
                    }
                },
            }),
            [],
        );

        if (!quillReady) {
            return <div className="min-h-40 flex-1 rounded-lg border border-border bg-card" aria-hidden="true" />;
        }

        return (
            <ReactQuill
                ref={quillRef as React.RefObject<unknown>}
                theme="snow"
                value={displayValue}
                onChange={onChange}
                placeholder={placeholder ?? "Compose the email body… click a chip below to insert {{variables}}."}
                formats={MAIL_FORMATS}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card leading-relaxed focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background [&_.ql-container]:min-h-0 [&_.ql-container]:min-h-40 [&_.ql-container]:flex-1 [&_.ql-container]:border-0! [&_.ql-container]:bg-card [&_.ql-editor]:min-h-40 [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:p-5! [&_.ql-editor]:text-sm [&_.ql-editor]:leading-relaxed! [&_.ql-editor]:text-foreground [&_.ql-editor.ql-blank::before]:text-muted-foreground! [&_.ql-editor.ql-blank::before]:not-italic! [&_.ql-toolbar]:border-x-0! [&_.ql-toolbar]:border-t-0! [&_.ql-toolbar]:border-b! [&_.ql-toolbar]:border-b-border! [&_.ql-toolbar]:bg-muted/40 [&_button]:text-muted-foreground [&_button:hover]:text-foreground! [&_.ql-toolbar_.ql-picker-label]:text-muted-foreground [&_.ql-toolbar_.ql-stroke]:stroke-muted-foreground! [&_.ql-toolbar_.ql-fill]:fill-muted-foreground! [&_.ql-var-chip]:inline-block [&_.ql-var-chip]:cursor-default [&_.ql-var-chip]:rounded-md [&_.ql-var-chip]:border [&_.ql-var-chip]:border-primary/50 [&_.ql-var-chip]:bg-primary/15 [&_.ql-var-chip]:px-2 [&_.ql-var-chip]:py-0.5 [&_.ql-var-chip]:text-xs [&_.ql-var-chip]:font-medium [&_.ql-var-chip]:text-primary"
            modules={chipsOn ? { toolbar: MAIL_TOOLBAR, "var-chip": true } : { toolbar: MAIL_TOOLBAR }}
        />
    );
    },
);
