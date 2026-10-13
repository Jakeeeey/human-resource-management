"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, ChevronUp, Italic, Strikethrough, Underline } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { IdNode } from "../types/id-layout.schema";
import type { IdDocStore } from "../engine/store";

const ID_FONT_CHOICES = ["Arial, Helvetica, sans-serif", "Arial Black, Arial, sans-serif", "Georgia, serif", "Times New Roman, serif", "Verdana, Geneva, sans-serif", "Courier New, monospace"];

const ID_RASTER_MIMES = ["image/png", "image/jpeg", "image/webp"];

const ID_RASTER_PREFIXES = ["data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,"];

const ID_UPLOAD_MAX = 5 * 1024 * 1024;

function propString(node: IdNode, key: string, fallback = ""): string {
    const value = (node.props as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : fallback;
}

function propNumber(node: IdNode, key: string, fallback: number): number {
    const value = (node.props as unknown as Record<string, unknown>)[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function propBool(node: IdNode, key: string): boolean {
    return (node.props as unknown as Record<string, unknown>)[key] === true;
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2.5">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
            <div className="grid grid-cols-2 gap-2.5">{children}</div>
        </section>
    );
}

function NumericField({ label, value, step, min, max, onCommit }: { readonly label: string; readonly value: number; readonly step?: number; readonly min?: number; readonly max?: number; readonly onCommit: (next: number) => void }) {
    const id = useId();
    const [draft, setDraft] = useState(String(value));
    const [prev, setPrev] = useState(value);
    if (prev !== value) {
        setPrev(value);
        setDraft(String(value));
    }
    const stepValue = step ?? 1;
    const nudge = (direction: 1 | -1): void => {
        const trimmed = draft.trim();
        const base = trimmed === "" ? value : Number(trimmed);
        const current = Number.isFinite(base) ? base : value;
        const decimals = String(stepValue).split(".")[1]?.length ?? 0;
        const raw = current + direction * stepValue;
        const rounded = Number(raw.toFixed(decimals));
        const next = min !== undefined ? Math.max(min, rounded) : rounded;
        const clamped = max !== undefined ? Math.min(max, next) : next;
        setDraft(String(clamped));
        onCommit(clamped);
    };
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    className="h-8 pr-8 text-xs tabular-nums"
                    id={id}
                    inputMode="decimal"
                    max={max}
                    min={min}
                    step={step ?? "any"}
                    type="number"
                    value={draft}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        if (event.target.value.trim() === "") return;
                        const parsed = Number(event.target.value);
                        if (Number.isFinite(parsed)) onCommit(parsed);
                    }}
                />
                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded">
                    <button
                        aria-label={`Increase ${label}`}
                        className="flex h-3.5 w-5 items-center justify-center text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        type="button"
                        onClick={() => nudge(1)}
                    >
                        <ChevronUp aria-hidden="true" className="size-3" />
                    </button>
                    <button
                        aria-label={`Decrease ${label}`}
                        className="flex h-3.5 w-5 items-center justify-center text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        type="button"
                        onClick={() => nudge(-1)}
                    >
                        <ChevronDown aria-hidden="true" className="size-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TextField({ label, value, span, mono, onCommit }: { readonly label: string; readonly value: string; readonly span?: boolean; readonly mono?: boolean; readonly onCommit: (next: string) => void }) {
    const id = useId();
    return (
        <div className={cn("space-y-1.5", span && "col-span-2")}>
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</Label>
            <Input className={cn("h-8 text-xs", mono && "font-mono")} id={id} value={value} onChange={(event) => onCommit(event.target.value)} />
        </div>
    );
}

function ColorField({ label, value, fallback, onCommit }: { readonly label: string; readonly value: string; readonly fallback: string; readonly onCommit: (next: string) => void }) {
    const id = useId();
    const swatch = /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    aria-label={`${label} swatch`}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-md border bg-card"
                    type="color"
                    value={swatch}
                    onChange={(event) => onCommit(event.target.value)}
                />
                <Input className="h-8 text-xs tabular-nums" id={id} spellCheck={false} value={value} onChange={(event) => onCommit(event.target.value)} />
            </div>
        </div>
    );
}

function AlignField({ node, store }: { readonly node: IdNode; readonly store: IdDocStore }) {
    const updateProps = store((state) => state.updateProps);
    const current = propString(node, "align", "left");
    const options = [
        { value: "left", label: "Align left", Icon: AlignLeft },
        { value: "center", label: "Align center", Icon: AlignCenter },
        { value: "right", label: "Align right", Icon: AlignRight },
    ];
    return (
        <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground" id={`id-align-${node.id}`}>Alignment</span>
            <div aria-labelledby={`id-align-${node.id}`} className="flex items-center gap-1" role="group">
                {options.map(({ value, label, Icon }) => (
                    <Button aria-label={label} aria-pressed={current === value} key={value} size="icon-sm" variant={current === value ? "secondary" : "ghost"} onClick={() => updateProps(node.id, { align: value })}>
                        <Icon />
                    </Button>
                ))}
            </div>
        </div>
    );
}

function TextStyleToggles({ node, store }: { readonly node: IdNode; readonly store: IdDocStore }) {
    const updateProps = store((state) => state.updateProps);
    const bold = propString(node, "fontWeight", "normal") === "bold";
    const italic = propBool(node, "italic");
    const underline = propBool(node, "underline");
    const strikethrough = propBool(node, "strikethrough");
    const toggles = [
        { label: "Bold", pressed: bold, Icon: Bold, onClick: () => updateProps(node.id, { fontWeight: bold ? "normal" : "bold" }) },
        { label: "Italic", pressed: italic, Icon: Italic, onClick: () => updateProps(node.id, { italic: !italic }) },
        { label: "Underline", pressed: underline, Icon: Underline, onClick: () => updateProps(node.id, { underline: !underline }) },
        { label: "Strikethrough", pressed: strikethrough, Icon: Strikethrough, onClick: () => updateProps(node.id, { strikethrough: !strikethrough }) },
    ];
    return (
        <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Style</span>
            <div aria-label="Text style" className="flex items-center gap-1" role="group">
                {toggles.map(({ label, pressed, Icon, onClick }) => (
                    <Button aria-label={label} aria-pressed={pressed} key={label} size="icon-sm" variant={pressed ? "secondary" : "ghost"} onClick={onClick}>
                        <Icon />
                    </Button>
                ))}
            </div>
        </div>
    );
}

function ToggleRow({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (next: boolean) => void }) {
    const id = useId();
    return (
        <div className="col-span-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</Label>
            <Switch checked={checked} id={id} size="sm" onCheckedChange={onChange} />
        </div>
    );
}

function SelectRow({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly { readonly value: string; readonly label: string }[]; readonly onChange: (next: string) => void }) {
    return (
        <div className="col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger aria-label={label} className="h-8 w-full text-xs" size="sm">
                    <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function ImageAssetField({ node, store }: { readonly node: IdNode; readonly store: IdDocStore }) {
    const pickerId = useId();
    const updateProps = store((state) => state.updateProps);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground" htmlFor={pickerId}>Upload raster image</Label>
            <Input
                accept={ID_RASTER_MIMES.join(",")}
                aria-invalid={error !== null}
                className={cn("h-8 text-xs", error && "border-destructive")}
                disabled={uploading}
                id={pickerId}
                type="file"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (!ID_RASTER_MIMES.includes(file.type)) {
                        setError("Only PNG, JPEG, or WebP images are allowed");
                        return;
                    }
                    if (file.size <= 0 || file.size > ID_UPLOAD_MAX) {
                        setError("File is empty or larger than 5 MB");
                        return;
                    }
                    setUploading(true);
                    setError(null);
                    const reader = new FileReader();
                    reader.onload = () => {
                        setUploading(false);
                        const url = typeof reader.result === "string" ? reader.result : "";
                        if (!ID_RASTER_PREFIXES.some((prefix) => url.startsWith(prefix))) {
                            setError("Only PNG, JPEG, or WebP images are allowed");
                            return;
                        }
                        updateProps(node.id, { src: url });
                    };
                    reader.onerror = () => {
                        setUploading(false);
                        setError("Image upload failed");
                    };
                    reader.readAsDataURL(file);
                }}
            />
            {uploading ? <p aria-live="polite" className="text-[11px] text-muted-foreground">Reading file…</p> : null}
            {error !== null ? <p className="text-[11px] leading-snug text-destructive" role="alert">{error}</p> : null}
        </div>
    );
}

export function IdPropertyPanel({ store }: { readonly store: IdDocStore }) {
    const nodes = store((state) => state.nodes);
    const selection = store((state) => state.selection);
    const updateProps = store((state) => state.updateProps);
    const moveNode = store((state) => state.moveNode);
    const resizeNode = store((state) => state.resizeNode);
    const rotateNode = store((state) => state.rotateNode);
    const setOpacity = store((state) => state.setOpacity);
    const reorderNode = store((state) => state.reorderNode);
    const setLocked = store((state) => state.setLocked);
    const beginGesture = store((state) => state.beginGesture);
    const endGesture = store((state) => state.endGesture);

    const node = selection.length === 1 && selection[0] !== undefined ? nodes[selection[0]] : undefined;

    if (!node) {
        return (
            <aside aria-label="Properties" className="flex min-h-0 w-full flex-1 flex-col bg-card">
                <div className="flex h-11 shrink-0 items-center border-b px-4">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Properties</span>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                    <p className="text-xs font-medium">{selection.length > 1 ? `${selection.length} blocks selected` : "No block selected"}</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {selection.length > 1 ? "Select a single block to edit it here." : "Click a block on the canvas or in Layers to edit it here."}
                    </p>
                </div>
            </aside>
        );
    }

    const isText = node.type === "text" || node.type === "variable";
    const reorder = (direction: "up" | "down"): void => {
        beginGesture();
        reorderNode(node.id, direction);
        endGesture();
    };

    return (
        <aside aria-label="Properties" className="flex min-h-0 w-full flex-1 flex-col bg-card">
            <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Properties</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize">{node.type}</span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                <Section title="Lock">
                    <ToggleRow label="Locked" checked={node.locked === true} onChange={(next) => setLocked(node.id, next)} />
                </Section>
                {node.type === "variable" ? (
                    <Section title="Field binding">
                        <TextField label="Prefix" value={propString(node, "prefix", "")} onCommit={(next) => updateProps(node.id, { prefix: next })} />
                        <TextField label="Suffix" value={propString(node, "suffix", "")} onCommit={(next) => updateProps(node.id, { suffix: next })} />
                        <SelectRow
                            label="Letter case"
                            value={propString(node, "transform", "none")}
                            options={[{ value: "none", label: "As stored" }, { value: "upper", label: "UPPERCASE" }, { value: "lower", label: "lowercase" }]}
                            onChange={(next) => updateProps(node.id, { transform: next })}
                        />
                    </Section>
                ) : null}
                {node.type === "image" ? (
                    <Section title="Image">
                        {propString(node, "source", "asset") === "field" ? null : (
                            <ImageAssetField node={node} store={store} />
                        )}
                        <SelectRow
                            label="Fit"
                            value={propString(node, "fit", "cover")}
                            options={[{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }, { value: "fill", label: "Fill" }]}
                            onChange={(next) => updateProps(node.id, { fit: next })}
                        />
                        <NumericField label="Corner radius" value={propNumber(node, "radius", 0)} min={0} onCommit={(next) => updateProps(node.id, { radius: Math.max(0, next) })} />
                        <SelectRow
                            label="Mask"
                            value={propString(node, "mask", "none")}
                            options={[{ value: "none", label: "None" }, { value: "circle", label: "Circle" }, { value: "ellipse", label: "Ellipse" }, { value: "rounded", label: "Rounded" }, { value: "diamond", label: "Diamond" }, { value: "hexagon", label: "Hexagon" }, { value: "star", label: "Star" }]}
                            onChange={(next) => updateProps(node.id, { mask: next })}
                        />
                    </Section>
                ) : null}
                {node.type === "text" ? (
                    <Section title="Content">
                        <div className="col-span-2 rounded-md border bg-muted/50 p-2">
                            <p className="text-[11px] leading-relaxed text-muted-foreground">Double-click the text on the canvas to edit its content.</p>
                        </div>
                    </Section>
                ) : null}
                {isText ? (
                    <Section title="Typography">
                        <div className="col-span-2 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Font family</span>
                            <Select value={propString(node, "fontFamily", ID_FONT_CHOICES[0] ?? "")} onValueChange={(next) => updateProps(node.id, { fontFamily: next })}>
                                <SelectTrigger aria-label="Font family" className="h-8 w-full text-xs" size="sm">
                                    <SelectValue placeholder="Font family" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {ID_FONT_CHOICES.map((font) => (
                                        <SelectItem key={font} value={font}>{font.split(",")[0]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <NumericField label="Font size" value={propNumber(node, "fontSize", 16)} min={1} onCommit={(next) => updateProps(node.id, { fontSize: Math.max(1, next) })} />
                        <TextStyleToggles node={node} store={store} />
                        <ColorField label="Text color" value={propString(node, "color", "#111111")} fallback="#111111" onCommit={(next) => updateProps(node.id, { color: next })} />
                        <AlignField node={node} store={store} />
                        <NumericField label="Letter spacing" value={propNumber(node, "letterSpacing", 0)} onCommit={(next) => updateProps(node.id, { letterSpacing: next })} />
                        <NumericField label="Line height" value={propNumber(node, "lineHeight", 1.4)} min={0.5} onCommit={(next) => updateProps(node.id, { lineHeight: Math.max(0.5, next) })} />
                        <NumericField label="Stroke width" value={propNumber(node, "strokeWidth", 0)} min={0} onCommit={(next) => updateProps(node.id, { strokeWidth: Math.max(0, next) })} />
                        <ColorField label="Stroke color" value={propString(node, "strokeColor", "#000000")} fallback="#000000" onCommit={(next) => updateProps(node.id, { strokeColor: next })} />
                    </Section>
                ) : null}
                {node.type === "shape" ? (
                    <Section title="Fill and border">
                        <ColorField label="Fill" value={propString(node, "fill", "#2563eb")} fallback="#2563eb" onCommit={(next) => updateProps(node.id, { fill: next })} />
                        <ColorField label="Border color" value={propString(node, "borderColor", "#1e40af")} fallback="#1e40af" onCommit={(next) => updateProps(node.id, { borderColor: next })} />
                        <NumericField label="Border width" value={propNumber(node, "borderWidth", 0)} min={0} onCommit={(next) => updateProps(node.id, { borderWidth: Math.max(0, next) })} />
                        <NumericField label="Corner radius" value={propNumber(node, "radius", 8)} min={0} onCommit={(next) => updateProps(node.id, { radius: Math.max(0, next) })} />
                        <div className="col-span-2 space-y-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Shape</span>
                            <Select value={propString(node, "shape", "rect")} onValueChange={(next) => updateProps(node.id, { shape: next })}>
                                <SelectTrigger aria-label="Shape" className="h-8 w-full text-xs" size="sm">
                                    <SelectValue placeholder="Shape" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    <SelectItem value="rect">Rectangle</SelectItem>
                                    <SelectItem value="ellipse">Ellipse</SelectItem>
                                    <SelectItem value="line">Line</SelectItem>
                                    <SelectItem value="triangle">Triangle</SelectItem>
                                    <SelectItem value="diamond">Diamond</SelectItem>
                                    <SelectItem value="pentagon">Pentagon</SelectItem>
                                    <SelectItem value="hexagon">Hexagon</SelectItem>
                                    <SelectItem value="star">Star</SelectItem>
                                    <SelectItem value="arrow">Arrow</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </Section>
                ) : null}
                <Section title="Position">
                    <NumericField label="X" value={node.x} onCommit={(next) => moveNode(node.id, Math.round(next), node.y)} />
                    <NumericField label="Y" value={node.y} onCommit={(next) => moveNode(node.id, node.x, Math.round(next))} />
                    <NumericField label="W" value={node.w} onCommit={(next) => resizeNode(node.id, Math.max(1, Math.round(next)), node.h)} />
                    <NumericField label="H" value={node.h} onCommit={(next) => resizeNode(node.id, node.w, Math.max(1, Math.round(next)))} />
                    <NumericField label="Rotation" value={node.rotation} onCommit={(next) => rotateNode(node.id, Math.round(next))} />
                    <NumericField label="Opacity" value={node.opacity} min={0} max={1} step={0.05} onCommit={(next) => setOpacity(node.id, Math.min(1, Math.max(0, next)))} />
                </Section>
                <Section title="Stacking">
                    <div className="col-span-2 flex items-center gap-2">
                        <Button aria-label="Bring forward" className="flex-1" size="sm" variant="outline" onClick={() => reorder("up")}>Forward</Button>
                        <Button aria-label="Send backward" className="flex-1" size="sm" variant="outline" onClick={() => reorder("down")}>Backward</Button>
                    </div>
                </Section>
            </div>
        </aside>
    );
}
