"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

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
// outside the toolbar groups (image/video/headers-beyond-2).
const MAIL_FORMATS = ["header", "bold", "italic", "underline", "strike", "list", "link"];

interface MailTemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

/** Minimal insert API: returns true when the token landed at the cursor. */
export interface MailTemplateEditorHandle {
    insertToken: (token: string) => boolean;
}

interface QuillInstance {
    focus: () => void;
    getSelection: () => { index: number; length: number } | null;
    insertText: (index: number, text: string, source: string) => void;
    setSelection: (index: number, length: number, source: string) => void;
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

        // Focus-then-insert only: no selection-restore machinery. False when
        // the editor is unmounted or has no selection (caller appends then).
        useImperativeHandle(
            ref,
            () => ({
                insertToken: (token: string) => {
                    try {
                        const editor = quillRef.current?.getEditor?.();
                        if (!editor) return false;
                        editor.focus();
                        const range = editor.getSelection();
                        if (!range) return false;
                        editor.insertText(range.index, token, "user");
                        editor.setSelection(range.index + token.length, 0, "user");
                        return true;
                    } catch {
                        return false;
                    }
                },
            }),
            [],
        );

        return (
            <ReactQuill
                ref={quillRef as React.RefObject<unknown>}
                theme="snow"
                value={value}
                onChange={onChange}
                placeholder={placeholder ?? "Compose the email body… click a chip below to insert {{variables}}."}
                formats={MAIL_FORMATS}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card leading-relaxed focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background [&_.ql-container]:min-h-40 [&_.ql-container]:flex-1 [&_.ql-container]:border-0! [&_.ql-container]:bg-card [&_.ql-editor]:min-h-40 [&_.ql-editor]:p-5! [&_.ql-editor]:text-sm [&_.ql-editor]:leading-relaxed! [&_.ql-editor]:text-foreground [&_.ql-editor.ql-blank::before]:text-muted-foreground! [&_.ql-editor.ql-blank::before]:not-italic! [&_.ql-toolbar]:border-x-0! [&_.ql-toolbar]:border-t-0! [&_.ql-toolbar]:border-b! [&_.ql-toolbar]:border-b-border! [&_.ql-toolbar]:bg-muted/40 [&_button]:text-muted-foreground [&_button:hover]:text-foreground! [&_.ql-toolbar_.ql-picker-label]:text-muted-foreground [&_.ql-toolbar_.ql-stroke]:stroke-muted-foreground! [&_.ql-toolbar_.ql-fill]:fill-muted-foreground!"
            modules={{ toolbar: MAIL_TOOLBAR }}
        />
    );
    },
);
