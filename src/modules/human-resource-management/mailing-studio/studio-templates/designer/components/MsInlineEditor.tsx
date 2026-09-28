"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Bold, Braces, Italic, Link2, RemoveFormatting, Underline, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

interface MsVariableDialogProps {
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly catalog: readonly MsCatalogRow[];
    readonly variableEventKey: string;
    readonly onVariableEventChange: (value: string) => void;
    readonly onInsertToken: (name: string) => boolean;
}

function MsVariableDialog({
    open,
    onOpenChange,
    catalog,
    variableEventKey,
    onVariableEventChange,
    onInsertToken,
}: MsVariableDialogProps) {
    const [draftEvent, setDraftEvent] = useState(variableEventKey);
    const [draftVariable, setDraftVariable] = useState("");
    const selectedRow = catalog.find((row) => row.event_key === draftEvent) ?? null;
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

    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            document.getElementById("ms-variable-event")?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [open ]);

    const handleEventChange = (value: string): void => {
        setDraftEvent(value);
        setDraftVariable("");
        onVariableEventChange(value);
    };

    const handleInsert = (): void => {
        if (draftVariable === "") return;
        onInsertToken(draftVariable);
        onOpenChange(false);
    };

    return (
        <>
            <Button
                aria-label="Insert variable"
                size="icon-sm"
                variant="ghost"
                onClick={() => onOpenChange(true)}
                onMouseDown={(event) => event.preventDefault()}
            >
                <Braces />
            </Button>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[95vw] sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Insert variable</DialogTitle>
                        <DialogDescription>
                            Choose an event, then pick a variable to insert at the caret.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="ms-variable-event">
                                Event
                            </Label>
                            <MsCombobox
                                ariaLabel="Variable event"
                                emptyText="No events found."
                                id="ms-variable-event"
                                options={eventOptions}
                                placeholder="Select event…"
                                searchPlaceholder="Search events…"
                                value={draftEvent}
                                onValueChange={handleEventChange}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="ms-variable-pick">
                                Variable
                            </Label>
                            <MsCombobox
                                ariaLabel="Variable name"
                                disabled={draftEvent === ""}
                                emptyText="No variables found."
                                id="ms-variable-pick"
                                options={variableOptions}
                                placeholder="Select variable…"
                                searchPlaceholder="Search variables…"
                                value={draftVariable}
                                onValueChange={setDraftVariable}
                            />
                            {catalog.length === 0 ? (
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    No events registered yet.
                                </p>
                            ) : draftEvent === "" ? (
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    Pick an event to see its variables.
                                </p>
                            ) : variableNames.length === 0 ? (
                                <p className="text-[11px] leading-snug text-muted-foreground">
                                    This event has no variables registered yet.
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button size="sm" type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button disabled={draftVariable === ""} size="sm" type="button" onClick={handleInsert}>
                            Insert
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function MsInlineToolbar({
    onFormat,
    catalog,
    variableEventKey,
    onVariableEventChange,
    pickerOpen,
    onPickerOpenChange,
    onInsertToken,
}: {
    readonly onFormat: (command: MsInlineFormat) => void;
    readonly catalog?: readonly MsCatalogRow[];
    readonly variableEventKey?: string;
    readonly onVariableEventChange?: (value: string) => void;
    readonly pickerOpen?: boolean;
    readonly onPickerOpenChange?: (open: boolean) => void;
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
            {catalog && variableEventKey !== undefined && onVariableEventChange && pickerOpen !== undefined && onPickerOpenChange && onInsertToken ? (
                <MsVariableDialog
                    catalog={catalog}
                    open={pickerOpen}
                    variableEventKey={variableEventKey}
                    onInsertToken={onInsertToken}
                    onOpenChange={onPickerOpenChange}
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
        const pickerOpenRef = useRef(false);
        const [pickerOpen, setPickerOpen] = useState(false);
        const [pickerSession, setPickerSession] = useState(0);
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

        const refocusEditor = (): void => {
            const element = editableRef.current;
            if (!element) return;
            try {
                element.focus();
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const current = selection.getRangeAt(0);
                    if (element.contains(current.commonAncestorContainer)) return;
                }
                const saved = savedRangeRef.current;
                if (selection && saved && element.contains(saved.commonAncestorContainer)) {
                    selection.removeAllRanges();
                    selection.addRange(saved);
                    return;
                }
                placeCaretAtEnd(element);
            } catch {
                try {
                    element.focus();
                    placeCaretAtEnd(element);
                } catch {
                    return;
                }
            }
        };

        const handlePickerOpenChange = (next: boolean): void => {
            if (next) {
                captureCaret();
                pickerOpenRef.current = true;
                setPickerSession((session) => session + 1);
                setPickerOpen(true);
                return;
            }
            pickerOpenRef.current = false;
            setPickerOpen(false);
            refocusEditor();
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
                        key={pickerSession}
                        variableEventKey={variableEventKey}
                        onFormat={runFormat}
                        onInsertToken={insertToken}
                        onPickerOpenChange={handlePickerOpenChange}
                        onVariableEventChange={onVariableEventChange}
                        pickerOpen={pickerOpen}
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
                        if (pickerOpenRef.current) return;
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
                            if (pickerOpenRef.current) return;
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
