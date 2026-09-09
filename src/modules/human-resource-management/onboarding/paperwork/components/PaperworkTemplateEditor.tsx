"use client";

import React, { forwardRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as React.ElementType;

// Paperwork rich-text toolbar — ported lock from
// `recruitment/mailing/components/MailTemplateEditor.tsx` (MAIL_TOOLBAR row,
// copied from memo-creation MemoCreationDialog): exactly the allowed groups —
// headers 1-2, bold/italic/underline/strike, ordered/bullet lists, link,
// clean. NO colors/fonts/align/images/video/formulas. Ported, never imported
// (module boundary: mailing owns its editor, paperwork owns this one).
const PAPERWORK_TOOLBAR = [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "clean"],
];

// Formats lock (same ported row): blocks keyboard/paste insertion of anything
// outside the toolbar groups.
const PAPERWORK_FORMATS = ["header", "bold", "italic", "underline", "strike", "list", "link"];

interface PaperworkTemplateEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

/**
 * Client-only rich-text editor for paperwork template bodies (HTML-first —
 * no PDF rendering here; Todo 7 renders this HTML under the ink overlay).
 * @param value - Current editor HTML.
 * @param onChange - Called with the new HTML on edit.
 * @param placeholder - Empty-state hint.
 * @returns The snow-themed editor (SSR-disabled via dynamic import).
 */
export const PaperworkTemplateEditor = forwardRef<unknown, PaperworkTemplateEditorProps>(
    function PaperworkTemplateEditor({ value, onChange, placeholder }, ref) {
        const [ready, setReady] = useState(false);

        // Quill touches `document` at import time — client-only by design.
        useEffect(() => {
            let cancelled = false;
            void import("react-quill-new").then(() => {
                if (!cancelled) setReady(true);
            });
            return () => {
                cancelled = true;
            };
        }, []);

        if (!ready) {
            return <div className="min-h-40 flex-1 rounded-lg border border-border bg-card" aria-hidden="true" />;
        }

        return (
            <ReactQuill
                ref={ref as React.RefObject<unknown>}
                theme="snow"
                value={value}
                onChange={onChange}
                placeholder={placeholder ?? "Compose the paperwork body… signature zones are marked after saving."}
                formats={PAPERWORK_FORMATS}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card leading-relaxed focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background [&_.ql-container]:min-h-0 [&_.ql-container]:min-h-40 [&_.ql-container]:flex-1 [&_.ql-container]:border-0! [&_.ql-container]:bg-card [&_.ql-editor]:min-h-40 [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:p-5! [&_.ql-editor]:text-sm [&_.ql-editor]:leading-relaxed! [&_.ql-editor]:text-foreground [&_.ql-editor.ql-blank::before]:text-muted-foreground! [&_.ql-editor.ql-blank::before]:not-italic! [&_.ql-toolbar]:border-x-0! [&_.ql-toolbar]:border-t-0! [&_.ql-toolbar]:border-b! [&_.ql-toolbar]:border-b-border! [&_.ql-toolbar]:bg-muted/40 [&_button]:text-muted-foreground [&_button:hover]:text-foreground! [&_.ql-toolbar_.ql-picker-label]:text-muted-foreground [&_.ql-toolbar_.ql-stroke]:stroke-muted-foreground! [&_.ql-toolbar_.ql-fill]:fill-muted-foreground!"
            modules={{ toolbar: PAPERWORK_TOOLBAR }}
        />
    );
    },
);
