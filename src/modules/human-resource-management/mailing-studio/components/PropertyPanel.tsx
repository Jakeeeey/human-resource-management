"use client";

import { useId, useState, type ReactNode } from "react";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useCanvasDoc } from "../hooks/useCanvasDoc";
import { MS_IMAGE_UPLOAD_TYPES, uploadImage } from "../providers/designService";
import { extractTemplateTokens } from "../utils/template-render";
import {
    CANVAS_TEXT_MAX,
    defaultBlockProps,
    type BlockAlign,
    type CanvasNode,
} from "../types/canvas-doc.schema";

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

function ImageUploadField({ node }: { readonly node: CanvasNode }) {
    const pickerId = useId();
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={pickerId}>
                Upload
            </Label>
            <Input
                accept={MS_IMAGE_UPLOAD_TYPES.join(",")}
                aria-invalid={error !== null}
                className={cn("h-8 text-xs", error && "border-destructive")}
                data-testid="image-upload-input"
                disabled={uploading}
                id={pickerId}
                type="file"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    setUploading(true);
                    setError(null);
                    void uploadImage(file)
                        .then(({ url }) => {
                            updateProps(node.id, { src: url });
                            setUploading(false);
                        })
                        .catch((uploadError: unknown) => {
                            setUploading(false);
                            setError(
                                uploadError instanceof Error
                                    ? uploadError.message
                                    : "Image upload failed",
                            );
                        });
                }}
            />
            {uploading ? (
                <p aria-live="polite" className="text-[11px] leading-snug text-muted-foreground">
                    Uploading…
                </p>
            ) : null}
            {error !== null ? (
                <p className="text-[11px] leading-snug text-destructive" role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

function ImageSrcField({ node }: { readonly node: CanvasNode }) {    const id = useId();
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

function styleString(node: CanvasNode, key: string, fallback = ""): string {
    const theme = defaultBlockProps(node.type);
    const stored = node.props[key];
    if (typeof stored === "string" && stored.length > 0) return stored;
    const themed = theme[key];
    return typeof themed === "string" ? themed : fallback;
}

function styleNumber(node: CanvasNode, key: string, fallback: number): number {
    const theme = defaultBlockProps(node.type);
    const stored = node.props[key];
    if (typeof stored === "number" && Number.isFinite(stored)) return stored;
    const themed = theme[key];
    return typeof themed === "number" ? themed : fallback;
}

function coerceHex(value: string, fallback: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function ColorField({
    label,
    value,
    fallback,
    onCommit,
}: {
    readonly label: string;
    readonly value: string;
    readonly fallback: string;
    readonly onCommit: (next: string | undefined) => void;
}) {
    const id = useId();
    const beginGesture = useCanvasDoc((state) => state.beginGesture);
    const endGesture = useCanvasDoc((state) => state.endGesture);
    const swatch = coerceHex(value, fallback);

    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
                {label}
            </Label>
            <div className="flex items-center gap-2">
                <input
                    aria-label={`${label} swatch`}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-card"
                    type="color"
                    value={swatch}
                    onBlur={endGesture}
                    onChange={(event) => onCommit(event.target.value)}
                    onFocus={beginGesture}
                />
                <Input
                    className="h-8 text-xs tabular-nums"
                    id={id}
                    spellCheck={false}
                    value={value}
                    onBlur={endGesture}
                    onChange={(event) => {
                        const next = event.target.value.trim();
                        onCommit(next.length > 0 ? next : undefined);
                    }}
                    onFocus={beginGesture}
                />
            </div>
        </div>
    );
}

const ALIGN_OPTIONS: readonly { readonly value: BlockAlign; readonly label: string; readonly Icon: typeof AlignLeft }[] = [
    { value: "left", label: "Align left", Icon: AlignLeft },
    { value: "center", label: "Align center", Icon: AlignCenter },
    { value: "right", label: "Align right", Icon: AlignRight },
];

function AlignField({ node }: { readonly node: CanvasNode }) {
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const current = styleString(node, "align", "left");

    return (
        <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground" id={`align-${node.id}`}>
                Alignment
            </span>
            <div aria-labelledby={`align-${node.id}`} className="flex items-center gap-1" role="group">
                {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
                    <Button
                        aria-label={label}
                        aria-pressed={current === value}
                        key={value}
                        size="icon-sm"
                        variant={current === value ? "secondary" : "ghost"}
                        onClick={() => updateProps(node.id, { align: value })}
                    >
                        <Icon />
                    </Button>
                ))}
            </div>
        </div>
    );
}

function TextContentField({ node }: { readonly node: CanvasNode }) {    const id = useId();
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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOKEN_NAME_PATTERN = /^[A-Za-z0-9_.]+$/;

function normaliseTokenName(raw: string): string | null {
    const stripped = raw
        .trim()
        .replace(/^\{\{\s*/, "")
        .replace(/\s*\}\}$/, "")
        .trim()
        .replace(/^payload\./, "");
    if (!TOKEN_NAME_PATTERN.test(stripped)) return null;
    return stripped;
}

function VariablesSection({ node }: { readonly node: CanvasNode }) {
    const inputId = useId();
    const updateProps = useCanvasDoc((state) => state.updateProps);
    const [draft, setDraft] = useState("");
    const [invalid, setInvalid] = useState(false);

    const text = typeof node.props.text === "string" ? node.props.text : "";
    const tokens = extractTemplateTokens(text);

    const insertToken = (key: string): void => {
        const separator =
            text.length === 0 || text.endsWith(" ") || text.endsWith("\n") ? "" : " ";
        updateProps(node.id, { text: `${text}${separator}{{${key}}}` });
    };

    const commitDraft = (): void => {
        const name = normaliseTokenName(draft);
        if (name === null) {
            setInvalid(draft.trim().length > 0);
            return;
        }
        setInvalid(false);
        setDraft("");
        insertToken(name);
    };

    const removeToken = (key: string): void => {
        const pattern = new RegExp(
            `\\{\\{\\s*(payload\\.)?${escapeRegExp(key)}\\s*\\}\\}`,
            "g",
        );
        updateProps(node.id, { text: text.replace(pattern, "") });
    };

    return (
        <div className="col-span-2 flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground" htmlFor={inputId}>
                    Add a variable
                </Label>
                <div className="flex items-center gap-1.5">
                    <Input
                        aria-invalid={invalid}
                        className={cn("h-8 font-mono text-xs", invalid && "border-destructive")}
                        id={inputId}
                        placeholder="employee_name"
                        spellCheck={false}
                        value={draft}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setInvalid(false);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                commitDraft();
                            }
                        }}
                    />
                    <Button
                        aria-label="Add variable to block"
                        size="sm"
                        type="button"
                        onClick={commitDraft}
                    >
                        Add
                    </Button>
                </div>
                {invalid ? (
                    <p className="text-[11px] leading-snug text-destructive" role="alert">
                        Use letters, numbers, dots or underscores — e.g. employee_name.
                    </p>
                ) : (
                    <p className="text-[11px] leading-snug text-muted-foreground">
                        Type any name and press Enter — it inserts {"{{name}}"} into this block.
                    </p>
                )}
            </div>
            {tokens.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                        In this block
                    </span>
                    <div className="flex flex-wrap gap-1" data-testid="block-tokens">
                        {tokens.map((token) => (
                            <span
                                className="flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                                key={token}
                            >
                                {`{{${token}}}`}
                                <button
                                    aria-label={`Remove variable ${token}`}
                                    className="font-sans text-xs leading-none transition-colors duration-150 hover:text-primary"
                                    type="button"
                                    onClick={() => removeToken(token)}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}
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

                {node.type === "text" || node.type === "button" ? (
                    <Section title="Variables">
                        <VariablesSection node={node} />
                    </Section>
                ) : null}

                {node.type === "image" ? (
                    <Section title="Content">
                        <ImageUploadField key={`upload-${node.id}`} node={node} />
                        <ImageSrcField key={node.id} node={node} />
                        <StringField
                            label="Alt text"
                            span
                            value={typeof node.props.alt === "string" ? node.props.alt : ""}
                            onCommit={(next) => updateProps(node.id, { alt: next })}
                        />
                    </Section>
                ) : null}

                {node.type === "text" || node.type === "button" ? (
                    <Section title="Typography">
                        <ColorField
                            fallback="#000000"
                            label="Text color"
                            value={styleString(node, "color", "#000000")}
                            onCommit={(next) => updateProps(node.id, { color: next })}
                        />
                        <NumericField
                            label="Font size"
                            value={styleNumber(node, "fontSize", 14)}
                            onCommit={(next) => updateProps(node.id, { fontSize: next })}
                        />
                        <StringField
                            label="Font family"
                            span
                            value={styleString(node, "fontFamily", "")}
                            onCommit={(next) => updateProps(node.id, { fontFamily: next })}
                        />
                        <AlignField node={node} />
                    </Section>
                ) : null}

                {node.type === "image" ? (
                    <Section title="Layout">
                        <AlignField node={node} />
                    </Section>
                ) : null}

                {node.type === "text" ||
                node.type === "button" ||
                node.type === "image" ||
                node.type === "box" ? (
                    <Section title="Appearance">
                        <ColorField
                            fallback="#ffffff"
                            label="Background"
                            value={styleString(node, "background", "")}
                            onCommit={(next) => updateProps(node.id, { background: next })}
                        />
                        <NumericField
                            label="Padding"
                            value={styleNumber(node, "padding", 0)}
                            onCommit={(next) => updateProps(node.id, { padding: next })}
                        />
                        <NumericField
                            label="Radius"
                            value={styleNumber(node, "radius", 0)}
                            onCommit={(next) => updateProps(node.id, { radius: next })}
                        />
                        <NumericField
                            label="Border width"
                            value={styleNumber(node, "borderWidth", 0)}
                            onCommit={(next) => updateProps(node.id, { borderWidth: next })}
                        />
                        <ColorField
                            fallback="#d1d5db"
                            label="Border color"
                            value={styleString(node, "borderColor", "")}
                            onCommit={(next) => updateProps(node.id, { borderColor: next })}
                        />
                    </Section>
                ) : null}

                {node.type === "divider" ? (
                    <Section title="Line">
                        <ColorField
                            fallback="#d1d5db"
                            label="Color"
                            value={styleString(node, "borderColor", "#d1d5db")}
                            onCommit={(next) => updateProps(node.id, { borderColor: next })}
                        />
                        <NumericField
                            label="Thickness"
                            value={styleNumber(node, "borderWidth", 1)}
                            onCommit={(next) => updateProps(node.id, { borderWidth: next })}
                        />
                        <NumericField
                            label="Padding"
                            value={styleNumber(node, "padding", 0)}
                            onCommit={(next) => updateProps(node.id, { padding: next })}
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
