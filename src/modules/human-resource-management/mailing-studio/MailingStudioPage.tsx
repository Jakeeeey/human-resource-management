"use client";

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";

import {
    Box,
    Eye,
    Layers,
    LayoutGrid,
    Mail,
    Minus,
    MousePointer2,
    MousePointerClick,
    Redo2,
    Save,
    Send,
    Settings2,
    Share2,
    Type,
    Undo2,
    X,
    Image,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { LayersPanel } from "./components/LayersPanel";
import { PropertyPanel } from "./components/PropertyPanel";
import { StageCanvas } from "./components/StageCanvas";
import { useCanvasDoc } from "./hooks/useCanvasDoc";
import { useDesignAutosave, type DesignAutosaveStatus } from "./hooks/useDesignAutosave";
import { getDesign, previewDesign } from "./providers/designService";
import { canvasDocSchema, defaultBlockProps, type CanvasNodeType } from "./types/canvas-doc.schema";

/**
 * Mailing Studio — Wave-0 chrome + T8 live freeform canvas + T8c control matrix.
 * Stage region is the live engine (components/StageCanvas); chrome per
 * ./DESIGN.md (tokens, geometry, states, motion, responsive intent).
 */

type PanelId = "select" | "elements" | "layers" | "settings";

interface RailItem {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly panel: PanelId;
}

interface ElementChip {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly type: CanvasNodeType;
}

const RAIL_ITEMS: readonly RailItem[] = [
    { label: "Select", icon: MousePointer2, panel: "select" },
    { label: "Elements", icon: LayoutGrid, panel: "elements" },
    { label: "Layers", icon: Layers, panel: "layers" },
    { label: "Settings", icon: Settings2, panel: "settings" },
];

const ELEMENT_CHIPS: readonly ElementChip[] = [
    { label: "Text", icon: Type, type: "text" },
    { label: "Image", icon: Image, type: "image" },
    { label: "Button", icon: MousePointerClick, type: "button" },
    { label: "Divider", icon: Minus, type: "divider" },
    { label: "Box", icon: Box, type: "box" },
    // Social has no dedicated node type yet — lands as a box shell (T8+).
    { label: "Social", icon: Share2, type: "box" },
];

const CHIP_NODE_SPEC: Record<
    CanvasNodeType,
    { readonly w: number; readonly h: number; readonly props: Record<string, unknown> }
> = {
    text: { w: 480, h: 44, props: { text: "New text block", ...defaultBlockProps("text") } },
    image: {
        w: 480,
        h: 160,
        props: { src: "https://placehold.co/480x160", alt: "Image", ...defaultBlockProps("image") },
    },
    button: { w: 180, h: 40, props: { text: "Read more", ...defaultBlockProps("button") } },
    divider: { w: 480, h: 2, props: { ...defaultBlockProps("divider") } },
    spacer: { w: 480, h: 24, props: { ...defaultBlockProps("spacer") } },
    box: { w: 480, h: 120, props: { ...defaultBlockProps("box") } },
};

// Plain-HTTP (insecure-context) origins have no crypto.randomUUID; the store
// only falls back to it when the draft omits id, so chip inserts supply one.
let chipSequence = 0;

function nextChipId(): string {
    chipSequence += 1;
    return `chip-${Date.now().toString(36)}-${chipSequence}`;
}

/** Chip → store.addNode with cascading default positions (40, 36 + n·72). */
function insertChipNode(type: CanvasNodeType): void {
    const store = useCanvasDoc.getState();
    const index = store.rootIds.length;
    const spec = CHIP_NODE_SPEC[type];
    const id = store.addNode({
        id: nextChipId(),
        parentId: "stage",
        type,
        x: 40,
        y: 36 + index * 72,
        w: spec.w,
        h: spec.h,
        rotation: 0,
        z: index,
        props: spec.props,
    });
    if (id) store.selectNodes([id]);
}

function StudioTopBar({
    name,
    onNameChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onPreview,
    onSendTest,
    sending,
    onSave,
    saveStatus,
}: {
    readonly name: string;
    readonly onNameChange: (next: string) => void;
    readonly onUndo: () => void;
    readonly onRedo: () => void;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly onPreview: () => void;
    readonly onSendTest: () => void;
    readonly sending: boolean;
    readonly onSave: () => void;
    readonly saveStatus: DesignAutosaveStatus;
}) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Mail aria-hidden="true" />
                </div>
                <Input
                    aria-label="Template name"
                    className="h-8 w-36 shrink border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input sm:w-56"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                />
                <span className="badge-neutral hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex">
                    Draft
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center">
                    <Button
                        aria-label="Undo"
                        disabled={!canUndo}
                        size="icon-sm"
                        variant="ghost"
                        onClick={onUndo}
                    >
                        <Undo2 />
                    </Button>
                    <Button
                        aria-label="Redo"
                        disabled={!canRedo}
                        size="icon-sm"
                        variant="ghost"
                        onClick={onRedo}
                    >
                        <Redo2 />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                    aria-label="Preview"
                    size="sm"
                    variant="outline"
                    onClick={onPreview}
                >
                    <Eye />
                    <span className="hidden sm:inline">Preview</span>
                </Button>
                <Button
                    aria-label="Send test"
                    disabled={sending}
                    size="sm"
                    variant="outline"
                    onClick={onSendTest}
                >
                    <Send />
                    <span className="hidden md:inline">{sending ? "Sending…" : "Send test"}</span>
                </Button>
                <Button
                    aria-label="Save design"
                    disabled={saveStatus === "saving"}
                    size="sm"
                    title={saveStatus === "error" ? "Last save failed" : undefined}
                    onClick={onSave}
                >
                    <Save />
                    {saveStatus === "saving" ? "Saving…" : "Save"}
                </Button>
            </div>
        </header>
    );
}

function StudioRail({
    active,
    onActivate,
}: {
    readonly active: PanelId;
    readonly onActivate: (panel: PanelId) => void;
}) {
    return (
        <nav
            aria-label="Studio tools"
            className="flex w-14 shrink-0 flex-col gap-1 border-r bg-card py-2"
        >
            {RAIL_ITEMS.map((item) => {
                const isActive = item.panel === active;
                return (
                    <button
                        aria-label={item.label}
                        aria-pressed={isActive}
                        className={cn(
                            "relative flex h-9 w-full items-center justify-center rounded-lg transition-colors duration-150",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                        key={item.label}
                        type="button"
                        onClick={() => onActivate(item.panel)}
                    >
                        <item.icon aria-hidden="true" />
                        {isActive ? (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                        ) : null}
                    </button>
                );
            })}
        </nav>
    );
}

function ElementsPanel() {
    return (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
            <div className="flex h-11 shrink-0 items-center border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Elements
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-2">
                    {ELEMENT_CHIPS.map((chip) => (
                        <button
                            className="group flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 transition duration-150 hover:-translate-y-0.5 hover:border-primary/40"
                            key={chip.label}
                            type="button"
                            onClick={() => insertChipNode(chip.type)}
                        >
                            <chip.icon
                                aria-hidden="true"
                                className="size-4 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
                            />
                            <span className="text-xs font-medium text-foreground">{chip.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="shrink-0 border-t p-3">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Click a block to add it to the canvas.
                </p>
            </div>
        </aside>
    );
}

function SettingsPanel({
    templateName,
    onTemplateNameChange,
    subject,
    onSubjectChange,
}: {
    readonly templateName: string;
    readonly onTemplateNameChange: (next: string) => void;
    readonly subject: string;
    readonly onSubjectChange: (next: string) => void;
}) {
    return (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
            <div className="flex h-11 shrink-0 items-center border-b px-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Settings
                </span>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto p-4">
                <section className="flex flex-col gap-2.5">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Template
                    </h3>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="settings-template-name">
                            Name
                        </Label>
                        <Input
                            aria-label="Template name"
                            className="h-8 text-xs"
                            id="settings-template-name"
                            value={templateName}
                            onChange={(event) => onTemplateNameChange(event.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="settings-subject">
                            Subject
                        </Label>
                        <Input
                            aria-label="Email subject"
                            className="h-8 text-xs"
                            id="settings-subject"
                            value={subject}
                            onChange={(event) => onSubjectChange(event.target.value)}
                        />
                    </div>
                </section>
            </div>
        </aside>
    );
}

function StudioStatusStrip({ width }: { readonly width: number }) {
    const nodeCount = useCanvasDoc((state) => Object.keys(state.nodes).length);
    const selectionCount = useCanvasDoc((state) => state.selection.length);

    return (
        <footer className="flex h-8 shrink-0 items-center justify-between border-t bg-card px-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
                <span className="tabular-nums">{width} px</span>
            </div>

            <div className="flex items-center gap-3">
                <span className="tabular-nums" data-testid="status-nodes">
                    {nodeCount} blocks
                </span>
                <span className="tabular-nums" data-testid="status-selection">
                    {selectionCount} selected
                </span>
            </div>
        </footer>
    );
}

// T10 save wiring: design_json + template meta only. body_html stays unset
// (null) until compile-on-save lands with T4/T6 (export-service) — no MJML here.
// Module-level const so the hook's options identity stays stable across renders.
const DEFAULT_DESIGN_META = {
    templateKey: "studio-draft",
    templateName: "October benefits statement",
    subject: "October benefits statement",
} as const;

function useHistoryCounts(): { canUndo: boolean; canRedo: boolean } {
    const pastCount = useStore(useCanvasDoc.temporal, (state) => state.pastStates.length);
    const futureCount = useStore(useCanvasDoc.temporal, (state) => state.futureStates.length);
    return { canUndo: pastCount > 0, canRedo: futureCount > 0 };
}

export function MailingStudioPage() {
    const [panel, setPanel] = useState<PanelId>("elements");
    const [templateName, setTemplateName] = useState<string>(DEFAULT_DESIGN_META.templateName);
    const [subject, setSubject] = useState<string>(DEFAULT_DESIGN_META.subject);
    const [previewing, setPreviewing] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const savedSelectionRef = useRef<string[]>([]);
    const [sending, setSending] = useState(false);
    const [hydrating, setHydrating] = useState(true);
    const { canUndo, canRedo } = useHistoryCounts();

    const EDITOR_WIDTH = 600;
    const width = EDITOR_WIDTH;

    const autosaveOptions = useMemo(
        () => ({
            templateKey: DEFAULT_DESIGN_META.templateKey,
            templateName,
            subject,
        }),
        [templateName, subject],
    );
    const { save, status, error } = useDesignAutosave(autosaveOptions);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const row = await getDesign(DEFAULT_DESIGN_META.templateKey);
                if (cancelled) return;
                if (row?.design_json) {
                    let parsed: unknown;
                    try {
                        parsed = JSON.parse(row.design_json);
                    } catch {
                        toast.error("Saved design is corrupt — starting fresh.");
                        return;
                    }
                    const result = canvasDocSchema.safeParse(parsed);
                    if (!result.success) {
                        toast.error("Saved design failed validation — starting fresh.");
                        return;
                    }
                    if (row.template_name) setTemplateName(row.template_name);
                    if (row.subject) setSubject(row.subject);
                    useCanvasDoc.getState().hydrate({
                        nodes: result.data.nodes,
                        rootIds: result.data.rootIds,
                    });
                }
            } catch (cause) {
                if (!cancelled) {
                    toast.error(cause instanceof Error ? cause.message : "Failed to load design.");
                }
            } finally {
                if (!cancelled) setHydrating(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (window.matchMedia("(max-width: 767px)").matches) setPanel("select");
    }, []);

    const errorToastedRef = useRef<string | null>(null);
    useEffect(() => {
        if (status === "error" && error && errorToastedRef.current !== error) {
            errorToastedRef.current = error;
            toast.error(`Save failed: ${error}`);
        }
    }, [status, error]);

    const handleSave = useCallback(async (): Promise<void> => {
        const ok = await save();
        if (ok) toast.success("Design saved.");
    }, [save]);

    // Preview = compiled receiver output. Snapshots the LIVE doc in-memory
    // (never saves), clears editor selection so no rings/handles persist, then
    // compiles through the real export path. The preview tree mounts NO
    // StageCanvas/Moveable — just an isolated iframe of the export HTML.
    const handlePreview = useCallback(async (): Promise<void> => {
        const store = useCanvasDoc.getState();
        savedSelectionRef.current = [...store.selection];
        store.selectNodes([]);
        const design_json = JSON.stringify({
            version: 1,
            width: 600,
            nodes: store.nodes,
            rootIds: store.rootIds,
        });
        setPreviewing(true);
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewHtml(null);
        setPreviewWarnings([]);
        try {
            const result = await previewDesign(design_json, subject);
            setPreviewHtml(result.html);
            setPreviewWarnings(result.warnings);
        } catch (cause) {
            setPreviewError(cause instanceof Error ? cause.message : "Preview failed");
        } finally {
            setPreviewLoading(false);
        }
    }, [subject]);

    // Exit restores the exact pre-preview editor state (selection included).
    const handleExitPreview = useCallback((): void => {
        setPreviewing(false);
        setPreviewHtml(null);
        setPreviewWarnings([]);
        setPreviewError(null);
        setPreviewLoading(false);
        const saved = savedSelectionRef.current;
        if (saved.length > 0) useCanvasDoc.getState().selectNodes(saved);
        savedSelectionRef.current = [];
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void handleSave();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleSave]);

    const handleSendTest = async (): Promise<void> => {
        if (sending) return;
        setSending(true);
        try {
            const response = await fetch("/api/hrm/mailing-studio/test-send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ template_key: DEFAULT_DESIGN_META.templateKey }),
            });
            if (!response.ok) {
                throw new Error(`Test send failed (HTTP ${response.status})`);
            }
            const payload = (await response.json().catch(() => null)) as {
                success?: boolean;
                message?: string;
                data?: { ok?: boolean; reason?: string };
            } | null;
            if (payload && payload.success === false) {
                throw new Error(payload.message ?? "Test send failed");
            }
            if (payload?.data?.ok) {
                toast.success("Test send recorded (dry-run) — nothing was emailed.");
            } else {
                toast.info(`Test send: ${payload?.data?.reason ?? "no outcome"}`);
            }
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Test send failed");
        } finally {
            setSending(false);
        }
    };

    if (hydrating) {
        return (
            <div
                className="flex min-h-0 w-full flex-1 items-center justify-center bg-background"
                data-testid="hydrate-loading"
                role="status"
            >
                <span className="text-sm text-muted-foreground">Loading design…</span>
            </div>
        );
    }

    if (previewing) {
        return (
            <div className="flex min-h-0 w-full flex-1 flex-col bg-background">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        Preview — receiver view
                    </span>
                    {previewWarnings.length > 0 ? (
                        <span
                            className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex"
                            data-testid="preview-warnings"
                        >
                            {previewWarnings.length} export notice
                            {previewWarnings.length === 1 ? "" : "s"}
                        </span>
                    ) : null}
                    <Button
                        aria-label="Exit preview"
                        size="sm"
                        variant="outline"
                        onClick={handleExitPreview}
                    >
                        <X />
                        Exit preview
                    </Button>
                </header>
                <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8 sm:px-6">
                    <span className="mb-3 shrink-0 rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm tabular-nums">
                        {width} px
                    </span>
                    {previewLoading ? (
                        <div
                            className="flex items-center justify-center py-16"
                            data-testid="preview-loading"
                            role="status"
                        >
                            <span className="text-sm text-muted-foreground">
                                Compiling preview…
                            </span>
                        </div>
                    ) : previewError ? (
                        <div
                            className="flex max-w-md flex-col items-center gap-3 py-16 text-center"
                            data-testid="preview-error"
                            role="alert"
                        >
                            <p className="text-sm text-muted-foreground">{previewError}</p>
                            <Button size="sm" variant="outline" onClick={handleExitPreview}>
                                <X />
                                Back to editor
                            </Button>
                        </div>
                    ) : previewHtml ? (
                        <div
                            className="w-full shrink-0 overflow-hidden rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                            data-testid="email-preview"
                            style={{ maxWidth: width }}
                        >
                            <iframe
                                sandbox=""
                                srcDoc={previewHtml}
                                style={{ border: 0, display: "block", height: 900, width: "100%" }}
                                title="Email preview"
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 w-full flex-1 flex-col bg-background">
            <StudioTopBar
                canRedo={canRedo}
                canUndo={canUndo}
                name={templateName}
                saveStatus={status}
                sending={sending}
                onNameChange={setTemplateName}
                onPreview={() => void handlePreview()}
                onRedo={() => useCanvasDoc.getState().redo()}
                onSave={() => void handleSave()}
                onSendTest={() => void handleSendTest()}
                onUndo={() => useCanvasDoc.getState().undo()}
            />
            <div className="flex min-h-0 flex-1">
                <StudioRail active={panel} onActivate={setPanel} />
                {panel === "elements" ? <ElementsPanel /> : null}
                {panel === "elements" ? (
                    <div
                        aria-label="Elements"
                        className="fixed inset-0 z-40 md:hidden"
                        role="dialog"
                    >
                        <button
                            aria-label="Close elements"
                            className="absolute inset-0 bg-background/60"
                            type="button"
                            onClick={() => setPanel("select")}
                        />
                        <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t bg-card p-3 shadow-xl">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                    Elements
                                </span>
                                <Button
                                    aria-label="Close elements"
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => setPanel("select")}
                                >
                                    <X />
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {ELEMENT_CHIPS.map((chip) => (
                                    <button
                                        className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3"
                                        key={chip.label}
                                        type="button"
                                        onClick={() => {
                                            insertChipNode(chip.type);
                                            setPanel("select");
                                        }}
                                    >
                                        <chip.icon
                                            aria-hidden="true"
                                            className="size-4 text-muted-foreground"
                                        />
                                        <span className="text-xs font-medium text-foreground">
                                            {chip.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : null}
                {panel === "layers" ? <LayersPanel /> : null}
                {panel === "settings" ? (
                    <SettingsPanel
                        templateName={templateName}
                        onTemplateNameChange={setTemplateName}
                        subject={subject}
                        onSubjectChange={setSubject}
                    />
                ) : null}
                <StageCanvas width={EDITOR_WIDTH} />
                <PropertyPanel />
            </div>
            <StudioStatusStrip width={EDITOR_WIDTH} />
        </div>
    );
}
