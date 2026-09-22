"use client";

import { useId, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import { CANVAS_TEXT_MAX, type CanvasNode } from "../types/canvas-doc.schema";

/**
 * Live properties panel (T8c): edits the first selected node through the store.
 * Content fields go through updateProps; geometry through move/resize/rotateNode.
 * Every field wraps focus→blur in beginGesture/endGesture so a typing session
 * coalesces to ONE history entry. Image src is validated to the canvas-doc
 * https-only rule before it is committed (cid:/data:/http:/.svg stay inline errors).
 */

function Section({
    title,
    children,
}: {
    readonly title: string;
    readonly children: ReactNode;
}) {
    return (
        <section className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {title}
            </h3>
            <div className="grid grid-cols-2 gap-2.5">{children}</div>
        </section>
    );
}

function validateHttpsImageSrc(value: string): string | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return "Image URL is required";
    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return "Enter an absolute URL (https://…)";
    }
    if (url.protocol === "cid:") return "cid: URLs are not allowed";
    if (url.protocol === "data:") return "data: URLs are not allowed";
    if (url.protocol === "http:") return "http: URLs are not allowed — use https:";
    if (url.protocol !== "https:") return `Only https: URLs are allowed (got ${url.protocol})`;
    if (url.pathname.toLowerCase().endsWith(".svg")) return ".svg images are not allowed";
    return null;
}

function NumericField({
    label,
    value,
    onCommit,
}: {
    readonly label: string;
    readonly value: number;
    readonly onCommit: (next: number) => void;
}) {
    const id = useId();
    const [draft, setDraft] = useState(String(value));
    const [prevValue, setPrevValue] = useState(value);
    if (prevValue !== value) {
        setPrevValue(value);
        setDraft(String(value));
    }
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);

    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
                {label}
            </Label>
            <Input
                className="h-8 text-xs tabular-nums"
                id={id}
                inputMode="decimal"
                value={draft}
                onBlur={endGesture}
                onChange={(event) => {
                    const next = event.target.value;
                    setDraft(next);
                    if (next.trim() === "") return;
                    const parsed = Number(next);
                    if (Number.isFinite(parsed)) onCommit(parsed);
                }}
                onFocus={beginGesture}
            />
        </div>
    );
}

function StringField({
    label,
    value,
    onCommit,
    span,
}: {
    readonly label: string;
    readonly value: string;
    readonly onCommit: (next: string) => void;
    readonly span?: boolean;
}) {
    const id = useId();
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);

    return (
        <div className={cn("space-y-1.5", span && "col-span-2")}>
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
                {label}
            </Label>
            <Input
                className="h-8 text-xs"
                id={id}
                value={value}
                onBlur={endGesture}
                onChange={(event) => onCommit(event.target.value)}
                onFocus={beginGesture}
            />
        </div>
    );
}

function ImageSrcField({ node }: { readonly node: CanvasNode }) {
    const id = useId();
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const stored = typeof node.props.src === "string" ? node.props.src : "";
    const [draft, setDraft] = useState(stored);
    const [error, setError] = useState<string | null>(null);
    const [prevStored, setPrevStored] = useState(stored);
    if (prevStored !== stored) {
        setPrevStored(stored);
        setDraft(stored);
        setError(null);
    }

    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
                Source
            </Label>
            <Input
                aria-invalid={error !== null}
                className={cn("h-8 text-xs", error && "border-destructive")}
                id={id}
                spellCheck={false}
                value={draft}
                onBlur={endGesture}
                onChange={(event) => {
                    const next = event.target.value;
                    setDraft(next);
                    const validationError = validateHttpsImageSrc(next);
                    setError(validationError);
                    if (validationError === null) {
                        updateProps(node.id, { src: next.trim() });
                    }
                }}
                onFocus={beginGesture}
            />
            {error !== null ? (
                <p className="text-[11px] leading-snug text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function TextContentField({ node }: { readonly node: CanvasNode }) {
    const id = useId();
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);

    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
                Text
            </Label>
            <Textarea
                className="min-h-[72px] text-xs leading-relaxed"
                id={id}
                maxLength={CANVAS_TEXT_MAX}
                value={typeof node.props.text === "string" ? node.props.text : ""}
                onBlur={endGesture}
                onChange={(event) => updateProps(node.id, { text: event.target.value })}
                onFocus={beginGesture}
            />
        </div>
    );
}

export function PropertyPanel() {
    const nodes = useCanvasDoc((state) => state.nodes);
    const selection = useCanvasDoc((state) => state.selection);
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const moveNode = useCanvasDoc((state) => state.moveNode);
    const resizeNode = useCanvasDoc((state) => state.resizeNode);
    const rotateNode = useCanvasDoc((state) => state.rotateNode);

    const node =
        selection.length === 1 && selection[0] !== undefined
            ? nodes[selection[0]]
            : undefined;

    if (!node) {
        const multi = selection.length > 1;
        return (
            <aside className="hidden w-[280px] shrink-0 flex-col border-l bg-card xl:flex">
                <div className="flex h-11 shrink-0 items-center border-b px-4">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Properties
                    </span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-xs font-medium text-foreground">
                        {multi ? `${selection.length} blocks selected` : "No block selected"}
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {multi
                            ? "Select a single block — on the canvas or in Layers — to edit it here."
                            : "Click a block on the canvas — or a row in Layers — to edit it here."}
                    </p>
                </div>
            </aside>
        );
    }

    return (
        <aside className="hidden w-[280px] shrink-0 flex-col border-l bg-card xl:flex">
            <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Properties
                </span>
                <span className="badge-neutral rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize">
                    {node.type}
                </span>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto p-4">
                {node.type === "text" ? (
                    <Section title="Content">
                        <TextContentField node={node} />
                    </Section>
                ) : null}

                {node.type === "button" ? (
                    <Section title="Content">
                        <StringField
                            label="Label"
                            value={typeof node.props.text === "string" ? node.props.text : ""}
                            onCommit={(next) => updateProps(node.id, { text: next })}
                        />
                        <StringField
                            label="Href"
                            value={typeof node.props.href === "string" ? node.props.href : ""}
                            onCommit={(next) => updateProps(node.id, { href: next })}
                        />
                    </Section>
                ) : null}

                {node.type === "image" ? (
                    <Section title="Content">
                        <ImageSrcField key={node.id} node={node} />
                        <StringField
                            label="Alt text"
                            span
                            value={typeof node.props.alt === "string" ? node.props.alt : ""}
                            onCommit={(next) => updateProps(node.id, { alt: next })}
                        />
                    </Section>
                ) : null}

                <Section title="Position">
                    <NumericField
                        label="X"
                        value={node.x}
                        onCommit={(next) => moveNode(node.id, next, node.y)}
                    />
                    <NumericField
                        label="Y"
                        value={node.y}
                        onCommit={(next) => moveNode(node.id, node.x, next)}
                    />
                </Section>

                <Section title="Size">
                    <NumericField
                        label="W"
                        value={node.w}
                        onCommit={(next) => resizeNode(node.id, next, node.h)}
                    />
                    <NumericField
                        label="H"
                        value={node.h}
                        onCommit={(next) => resizeNode(node.id, node.w, next)}
                    />
                </Section>

                <Section title="Transform">
                    <NumericField
                        label="Rotation"
                        value={node.rotation}
                        onCommit={(next) => rotateNode(node.id, next)}
                    />
                </Section>
            </div>
        </aside>
    );
}
