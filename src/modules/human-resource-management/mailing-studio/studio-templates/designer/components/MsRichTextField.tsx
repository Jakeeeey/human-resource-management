"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ElementType } from "react";

import "react-quill-new/dist/quill.snow.css";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import { CANVAS_TEXT_MAX, type CanvasNode } from "../types/canvas-doc.schema";
import { sanitizeMsInlineHtml } from "../utils/ms-inline-html-sanitize";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as ElementType;

const RICH_TOOLBAR = [["bold", "italic", "underline"], ["link", "clean"]];

const RICH_FORMATS = ["bold", "italic", "underline", "strike", "link"];

interface MsRichEditor {
    getHTML: () => string;
    getText: () => string;
}

function commitableHtml(editor: MsRichEditor): string | null {
    if (typeof editor.getHTML !== "function") return null;
    if (editor.getText().trim() === "") return "";
    const clean = sanitizeMsInlineHtml(editor.getHTML());
    return clean.length <= CANVAS_TEXT_MAX ? clean : null;
}

export function MsRichTextField({ node }: { readonly node: CanvasNode }) {
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const stored = typeof node.props.text === "string" ? node.props.text : "";
    const [draft, setDraft] = useState(stored);
    const [committed, setCommitted] = useState(stored);
    const [prevId, setPrevId] = useState(node.id);
    if (prevId !== node.id) {
        setPrevId(node.id);
        setDraft(stored);
        setCommitted(stored);
    } else if (stored !== committed) {
        setDraft(stored);
        setCommitted(stored);
    }
    const modules = useMemo(() => ({ toolbar: RICH_TOOLBAR }), []);

    return (
        <ReactQuill
            formats={RICH_FORMATS}
            modules={modules}
            theme="snow"
            value={draft}
            className="overflow-hidden rounded-md border border-input bg-background text-xs leading-relaxed focus-within:ring-2 focus-within:ring-ring [&_.ql-container]:border-0! [&_.ql-container]:bg-background [&_.ql-editor]:max-h-48 [&_.ql-editor]:min-h-20 [&_.ql-editor]:overflow-y-auto [&_.ql-editor]:p-2.5! [&_.ql-editor]:text-xs [&_.ql-editor]:leading-relaxed! [&_.ql-editor.ql-blank::before]:text-xs [&_.ql-editor.ql-blank::before]:text-muted-foreground! [&_.ql-editor.ql-blank::before]:not-italic! [&_.ql-toolbar]:border-x-0! [&_.ql-toolbar]:border-t-0! [&_.ql-toolbar]:border-b! [&_.ql-toolbar]:border-b-input! [&_.ql-toolbar]:bg-muted/40 [&_.ql-toolbar_.ql-active]:text-primary! [&_.ql-toolbar_.ql-active_.ql-stroke]:stroke-primary! [&_.ql-toolbar_.ql-active_.ql-fill]:fill-primary! [&_button]:text-muted-foreground"
            placeholder="Write text… {{variables}} stay intact."
            onBlur={(_range: unknown, _source: unknown, editor: MsRichEditor) => {
                const clean = commitableHtml(editor);
                if (clean !== null) {
                    setCommitted(clean);
                    updateProps(node.id, { text: clean });
                }
                endGesture();
            }}
            onChange={(html: string, _delta: unknown, source: string, editor: MsRichEditor) => {
                if (source !== "user") return;
                setDraft(html);
                const clean = commitableHtml(editor);
                if (clean === null) return;
                setCommitted(clean);
                updateProps(node.id, { text: clean });
            }}
            onFocus={() => {
                beginGesture();
            }}
        />
    );
}
