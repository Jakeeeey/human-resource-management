"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Bold, Italic, Link2, RemoveFormatting, Underline, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeIdInlineHtml } from "./sanitize";

export type IdInlineFormat = "bold" | "italic" | "underline" | "link" | "clear";

export interface IdInlineEditorHandle {
    commitNow: () => void;
    format: (command: IdInlineFormat) => void;
}

interface IdInlineEditorProps {
    readonly nodeId: string;
    readonly initialHtml: string;
    readonly autoFocus?: boolean;
    readonly onCommit: (cleanHtml: string) => void;
    readonly onBeginGesture: () => void;
    readonly onEndGesture: () => void;
    readonly onRequestClose?: () => void;
    readonly onUndo: () => void;
    readonly onRedo: () => void;
    readonly onReadText: () => string;
    readonly flipBelow?: boolean;
    readonly shiftLeft?: number;
}

export const ID_TEXT_MAX = 5_000;

const LINK_SCHEME_PATTERN = /^(https?:\/\/|mailto:)/i;
const ID_EDITOR_PLACEHOLDER = "Write text…";

function placeCaretAtEnd(element: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

const ID_TOOLBAR_ITEMS: ReadonlyArray<{ command: IdInlineFormat; label: string; Icon: LucideIcon }> = [
    { command: "bold", label: "Bold", Icon: Bold },
    { command: "italic", label: "Italic", Icon: Italic },
    { command: "underline", label: "Underline", Icon: Underline },
    { command: "link", label: "Link", Icon: Link2 },
    { command: "clear", label: "Clear formatting", Icon: RemoveFormatting },
];

export function IdInlineToolbar({ onFormat }: { readonly onFormat: (command: IdInlineFormat) => void }) {
    return (
        <div
            aria-label="Text formatting"
            className="flex items-center gap-0.5 rounded-md border bg-card p-1 shadow-md"
            role="toolbar"
            onMouseDown={(event) => event.preventDefault()}
        >
            {ID_TOOLBAR_ITEMS.map(({ command, label, Icon }) => (
                <Button
                    aria-label={label}
                    key={command}
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => onFormat(command)}
                    onMouseDown={(event) => event.preventDefault()}
                >
                    <Icon />
                </Button>
            ))}
        </div>
    );
}

export const IdInlineEditor = forwardRef<IdInlineEditorHandle, IdInlineEditorProps>(
    function IdInlineEditor(
        {
            nodeId,
            initialHtml,
            autoFocus,
            onCommit,
            onBeginGesture,
            onEndGesture,
            onRequestClose,
            onUndo,
            onRedo,
            onReadText,
            flipBelow = false,
            shiftLeft = 0,
        },
        ref,
    ) {
        const editableRef = useRef<HTMLDivElement | null>(null);
        const committedRef = useRef(sanitizeIdInlineHtml(initialHtml));
        const seedRef = useRef({ html: initialHtml, focus: autoFocus ?? false });

        const commitNow = (): void => {
            const element = editableRef.current;
            if (!element) return;
            const clean = sanitizeIdInlineHtml(element.innerHTML);
            if (clean.length > ID_TEXT_MAX) return;
            if (clean === committedRef.current) return;
            committedRef.current = clean;
            onCommit(clean);
        };

        const runFormat = (command: IdInlineFormat): void => {
            const element = editableRef.current;
            if (!element) return;
            element.focus();
            if (command === "link") {
                const answer = window.prompt("Link URL (https:// or mailto:)", "https://");
                if (answer === null) return;
                const url = answer.trim();
                if (!LINK_SCHEME_PATTERN.test(url)) return;
                document.execCommand("createLink", false, url);
            } else if (command === "clear") {
                document.execCommand("removeFormat", false);
                document.execCommand("unlink", false);
            } else {
                document.execCommand(command, false);
            }
            commitNow();
        };

        useImperativeHandle(ref, () => ({ commitNow, format: runFormat }));

        useEffect(() => {
            const element = editableRef.current;
            if (!element) return;
            element.innerHTML = sanitizeIdInlineHtml(seedRef.current.html);
            committedRef.current = sanitizeIdInlineHtml(seedRef.current.html);
            if (seedRef.current.focus) {
                element.focus();
                placeCaretAtEnd(element);
            }
        }, [nodeId]);

        return (
            <>
                <div
                    className="absolute z-30"
                    style={flipBelow ? { top: "calc(100% + 4px)", left: shiftLeft } : { bottom: "calc(100% + 4px)", left: shiftLeft }}
                >
                    <IdInlineToolbar onFormat={runFormat} />
                </div>
                <div
                    aria-label="Edit text on card"
                    aria-multiline="true"
                    className={cn(
                        "h-full w-full cursor-text overflow-hidden p-1.5 text-sm leading-relaxed text-foreground",
                        "focus:outline-none [&:empty::before]:text-muted-foreground [&:empty::before]:content-[attr(data-placeholder)]",
                    )}
                    contentEditable
                    data-placeholder={ID_EDITOR_PLACEHOLDER}
                    ref={editableRef}
                    role="textbox"
                    spellCheck={false}
                    onBlur={() => {
                        commitNow();
                        onEndGesture();
                        onRequestClose?.();
                    }}
                    onFocus={onBeginGesture}
                    onInput={commitNow}
                    onKeyDown={(event) => {
                        const element = editableRef.current;
                        if (!element) return;
                        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
                            const key = event.key.toLowerCase();
                            if (key === "z" || key === "y") {
                                event.preventDefault();
                                commitNow();
                                onEndGesture();
                                if (key === "y" || (key === "z" && event.shiftKey)) onRedo();
                                else onUndo();
                                const html = onReadText();
                                element.innerHTML = sanitizeIdInlineHtml(html);
                                committedRef.current = sanitizeIdInlineHtml(html);
                                element.focus();
                                placeCaretAtEnd(element);
                                onBeginGesture();
                                return;
                            }
                        }
                        if (event.key === "Escape") {
                            event.preventDefault();
                            commitNow();
                            onEndGesture();
                            onRequestClose?.();
                        }
                    }}
                    onPaste={(event) => {
                        event.preventDefault();
                        const text = event.clipboardData.getData("text/plain");
                        if (text.length === 0) return;
                        document.execCommand("insertText", false, text);
                        commitNow();
                    }}
                />
            </>
        );
    },
);
