"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Bold, Braces, Italic, Link2, RemoveFormatting, Underline, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import { CANVAS_TEXT_MAX } from "../types/canvas-doc.schema";
import type { MsCatalogRow } from "../../types/ms-catalog.schema";
import { extractPayloadKeys } from "../../utils/ms-variables";
import { sanitizeMsInlineHtml } from "../utils/ms-inline-html-sanitize";
import { MsCombobox } from "./MsCombobox";

export type MsInlineFormat = "bold" | "italic" | "underline" | "link" | "clear";

export interface MsInlineEditorHandle {
    insertToken: (name: string) => boolean;
    commitNow: () => void;
    format: (command: MsInlineFormat) => void;
}

interface MsInlineEditorProps {
    readonly nodeId: string;
    readonly initialHtml: string;
    readonly autoFocus?: boolean;
    readonly onCommit: (cleanHtml: string) => void;
    readonly onBeginGesture: () => void;
    readonly onEndGesture: () => void;
    readonly onRequestClose?: () => void;
    readonly catalog?: readonly MsCatalogRow[];
    readonly variableEventKey?: string;
    readonly onVariableEventChange?: (value: string) => void;
    readonly flipBelow?: boolean;
    readonly shiftLeft?: number;
}

const TOKEN_NAME_PATTERN = /^[A-Za-z0-9_.]{1,128}$/;
const LINK_SCHEME_PATTERN = /^(https?:\/\/|mailto:)/i;
const EDITOR_PLACEHOLDER = "Write text… {{variables}} stay intact.";

function placeCaretAtEnd(element: HTMLElement): void {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
}

const TOOLBAR_ITEMS: ReadonlyArray<{ command: MsInlineFormat; label: string; Icon: LucideIcon }> = [
    { command: "bold", label: "Bold", Icon: Bold },
    { command: "italic", label: "Italic", Icon: Italic },
    { command: "underline", label: "Underline", Icon: Underline },
    { command: "link", label: "Link", Icon: Link2 },
    { command: "clear", label: "Clear formatting", Icon: RemoveFormatting },
];

interface MsVariablePopoverProps {
    readonly catalog: readonly MsCatalogRow[];
    readonly variableEventKey: string;
    readonly onVariableEventChange: (value: string) => void;
    readonly onCaptureCaret: () => void;
    readonly onRestoreCaret: () => void;
    readonly onInsertToken: (name: string) => boolean;
}

function MsVariablePopover({
    catalog,
    variableEventKey,
    onVariableEventChange,
    onCaptureCaret,
    onRestoreCaret,
    onInsertToken,
}: MsVariablePopoverProps) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const selectedRow = catalog.find((row) => row.event_key === variableEventKey) ?? null;
    const variableNames = selectedRow
        ? extractPayloadKeys(selectedRow.payload_schema, selectedRow.payload_example)
        : [];
    const eventOptions = catalog.map((row) => ({
        value: row.event_key,
        label: row.label ? `${row.event_key} — ${row.label}` : row.event_key,
    }));
    const variableOptions = variableNames.map((name) => ({
        value: name,
        label: `{{${name}}}`,
    }));
    const variableDisabled = variableEventKey === "" || variableNames.length === 0;

    const handleEventChange = (next: string): void => {
        onVariableEventChange(next);
        onRestoreCaret();
    };

    const handleVariableChange = (next: string): void => {
        if (onInsertToken(next)) setOpen(false);
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent): void => {
            const target = event.target;
            if (target instanceof HTMLElement && target.closest('[data-slot="popover-content"]')) return;
            const wrap = wrapRef.current;
            if (wrap && target instanceof Node && !wrap.contains(target)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open ]);

    return (
        <div className="relative" ref={wrapRef}>
            <Button
                aria-expanded={open}
                aria-label="Insert variable"
                size="icon-sm"
                variant="ghost"
                onClick={() => setOpen((next) => !next)}
                onMouseDown={(event) => {
                    event.preventDefault();
                    onCaptureCaret();
                }}
            >
                <Braces />
            </Button>
            {open ? (
                <div className="absolute left-0 top-full z-50 mt-1 flex max-h-80 w-80 min-w-56 max-w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 overflow-hidden rounded-md border bg-popover p-2 shadow-md">
                    <div onMouseDown={onCaptureCaret}>
                        <MsCombobox
                            ariaLabel="Variable event"
                            emptyText="No events found."
                            options={eventOptions}
                            placeholder="Select event…"
                            searchPlaceholder="Search events…"
                            value={variableEventKey}
                            onValueChange={handleEventChange}
                        />
                    </div>
                    <div onMouseDown={onCaptureCaret}>
                        <MsCombobox
                            ariaLabel="Insert variable"
                            disabled={variableDisabled}
                            emptyText="No variables found."
                            options={variableOptions}
                            placeholder="Insert variable…"
                            searchPlaceholder="Search variables…"
                            value=""
                            onValueChange={handleVariableChange}
                        />
                    </div>
                    {variableEventKey === "" ? (
                        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                            Pick an event to see its variables.
                        </p>
                    ) : variableNames.length === 0 ? (
                        <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                            This event has no variables registered yet.
                        </p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function MsInlineToolbar({
    onFormat,
    catalog,
    variableEventKey,
    onVariableEventChange,
    onCaptureCaret,
    onRestoreCaret,
    onInsertToken,
}: {
    readonly onFormat: (command: MsInlineFormat) => void;
    readonly catalog?: readonly MsCatalogRow[];
    readonly variableEventKey?: string;
    readonly onVariableEventChange?: (value: string) => void;
    readonly onCaptureCaret?: () => void;
    readonly onRestoreCaret?: () => void;
    readonly onInsertToken?: (name: string) => boolean;
}) {
    return (
        <div
            aria-label="Text formatting"
            className="flex items-center gap-0.5 rounded-md border bg-card p-1 shadow-md"
            role="toolbar"
            onMouseDown={(event) => event.preventDefault()}
        >
            {TOOLBAR_ITEMS.map(({ command, label, Icon }) => (
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
            {catalog && variableEventKey !== undefined && onVariableEventChange && onCaptureCaret && onRestoreCaret && onInsertToken ? (
                <MsVariablePopover
                    catalog={catalog}
                    variableEventKey={variableEventKey}
                    onCaptureCaret={onCaptureCaret}
                    onRestoreCaret={onRestoreCaret}
                    onInsertToken={onInsertToken}
                    onVariableEventChange={onVariableEventChange}
                />
            ) : null}
        </div>
    );
}

export const MsInlineEditor = forwardRef<MsInlineEditorHandle, MsInlineEditorProps>(
    function MsInlineEditor(
        {
            nodeId,
            initialHtml,
            autoFocus,
            onCommit,
            onBeginGesture,
            onEndGesture,
            onRequestClose,
            catalog = [],
            variableEventKey = "",
            onVariableEventChange,
            flipBelow = false,
            shiftLeft = 0,
        },
        ref,
    ) {
        const editableRef = useRef<HTMLDivElement | null>(null);
        const savedRangeRef = useRef<Range | null>(null);
        const committedRef = useRef(sanitizeMsInlineHtml(initialHtml));
        const seedRef = useRef({ html: initialHtml, focus: autoFocus ?? false });

        const commitNow = (): void => {
            const element = editableRef.current;
            if (!element) return;
            const clean = sanitizeMsInlineHtml(element.innerHTML);
            if (clean.length > CANVAS_TEXT_MAX) return;
            if (clean === committedRef.current) return;
            committedRef.current = clean;
            onCommit(clean);
        };

        const runFormat = (command: MsInlineFormat): void => {
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

        const captureCaret = (): void => {
            const element = editableRef.current;
            const selection = window.getSelection();
            if (!element || !selection || selection.rangeCount === 0) {
                savedRangeRef.current = null;
                return;
            }
            const range = selection.getRangeAt(0);
            if (!element.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = null;
                return;
            }
            savedRangeRef.current = range.cloneRange();
        };

        const restoreCaret = (): void => {
            const element = editableRef.current;
            const selection = window.getSelection();
            if (!element || !selection) return;
            element.focus();
            const saved = savedRangeRef.current;
            if (saved && element.contains(saved.commonAncestorContainer)) {
                selection.removeAllRanges();
                selection.addRange(saved);
            }
        };

        const insertToken = (name: string): boolean => {
            if (!TOKEN_NAME_PATTERN.test(name)) return false;
            const element = editableRef.current;
            if (!element) return false;
            element.focus();
            const selection = window.getSelection();
            if (!selection) return false;
            const saved = savedRangeRef.current;
            if (saved && element.contains(saved.commonAncestorContainer)) {
                selection.removeAllRanges();
                selection.addRange(saved);
            }
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (element.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const textNode = document.createTextNode(`{{${name}}}`);
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    savedRangeRef.current = null;
                    commitNow();
                    return true;
                }
            }
            element.appendChild(document.createTextNode(`{{${name}}}`));
            placeCaretAtEnd(element);
            savedRangeRef.current = null;
            commitNow();
            return true;
        };

        useImperativeHandle(ref, () => ({ insertToken, commitNow, format: runFormat }));

        useEffect(() => {
            const element = editableRef.current;
            if (!element) return;
            element.innerHTML = sanitizeMsInlineHtml(seedRef.current.html);
            committedRef.current = sanitizeMsInlineHtml(seedRef.current.html);
            if (seedRef.current.focus) {
                element.focus();
                placeCaretAtEnd(element);
            }
        }, [nodeId]);

        return (
            <>
                <div
                    className="absolute z-30"
                    style={
                        flipBelow
                            ? { top: "calc(100% + 4px)", left: shiftLeft }
                            : { bottom: "calc(100% + 4px)", left: shiftLeft }
                    }
                >
                    <MsInlineToolbar
                        catalog={catalog}
                        variableEventKey={variableEventKey}
                        onCaptureCaret={captureCaret}
                        onRestoreCaret={restoreCaret}
                        onFormat={runFormat}
                        onInsertToken={insertToken}
                        onVariableEventChange={onVariableEventChange}
                    />
                </div>
                <div
                    aria-label="Edit text on canvas"
                    aria-multiline="true"
                    className={cn(
                        "h-full w-full cursor-text overflow-hidden p-1.5 text-sm leading-relaxed text-foreground",
                        "focus:outline-none [&:empty::before]:text-muted-foreground [&:empty::before]:content-[attr(data-placeholder)]",
                    )}
                    contentEditable
                    data-placeholder={EDITOR_PLACEHOLDER}
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
                                const store = useCanvasDoc.getState();
                                if (key === "y" || (key === "z" && event.shiftKey)) store.redo();
                                else store.undo();
                                const next = store.nodes[nodeId]?.props.text;
                                const html = typeof next === "string" ? next : "";
                                element.innerHTML = sanitizeMsInlineHtml(html);
                                committedRef.current = sanitizeMsInlineHtml(html);
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
