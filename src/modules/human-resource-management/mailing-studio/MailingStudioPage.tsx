"use client";

import type { LucideIcon } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "zustand";

import {
    Box,
    ChevronDown,
    Eye,
    HelpCircle,
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
    SlidersHorizontal,
    Type,
    Undo2,
    X,
    Image,
    ZoomIn,
    ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { DeviceSwitch, STUDIO_DEVICE_WIDTHS, type StudioDevice } from "./components/DeviceSwitch";
import { HelpPanel } from "./components/HelpPanel";
import { LayersPanel } from "./components/LayersPanel";
import { MsCombobox } from "./components/MsCombobox";
import { PropertyPanel } from "./components/PropertyPanel";
import { StageCanvas } from "./components/StageCanvas";
import { clampZoom, useCanvasDoc, ZOOM_STEP } from "./hooks/useCanvasDoc";
import { useDesignAutosave, type DesignAutosaveStatus } from "./hooks/useDesignAutosave";
import { getDesign, previewDesign, sendCompiledTest } from "./providers/designService";
import { fetchMsCatalog } from "./providers/msCatalog";
import { canvasDocSchema, defaultBlockProps, type CanvasNode, type CanvasNodeType } from "./types/canvas-doc.schema";
import { MS_EVENT_KEY_PATTERN, type MsCatalogRow } from "./types/ms-catalog.schema";
import { extractPayloadExample } from "./utils/ms-variables";
import { renderTemplate } from "./utils/template-render";

/**
 * Mailing Studio — Wave-0 chrome + T8 live freeform canvas + T8c control matrix.
 * Stage region is the live engine (components/StageCanvas); chrome per
 * ./DESIGN.md (tokens, geometry, states, motion, responsive intent).
 * Template identity is route-driven (?key=, P1-14); device width + zoom are
 * designer state (N5/P1-10); the send dialog mounts its portal content only
 * while open so no closed overlay can outlive it (N1).
 */

type PanelId = "select" | "elements" | "layers" | "settings" | "help";

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
    { label: "Help", icon: HelpCircle, panel: "help" },
];

const ELEMENT_CHIPS: readonly ElementChip[] = [
    { label: "Text", icon: Type, type: "text" },
    { label: "Image", icon: Image, type: "image" },
    { label: "Button", icon: MousePointerClick, type: "button" },
    { label: "Divider", icon: Minus, type: "divider" },
    { label: "Box", icon: Box, type: "box" },
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

const TEMPLATE_KEY_FALLBACK = "studio-draft";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface TemplateKeyResolution {
    readonly templateKey: string;
    readonly requestedKey: string | null;
    readonly keyRewritten: boolean;
}

function useTemplateKey(): TemplateKeyResolution {
    const params = useSearchParams();
    const requestedKey = params.get("key") ?? params.get("template_key");
    if (requestedKey !== null && MS_EVENT_KEY_PATTERN.test(requestedKey)) {
        return { templateKey: requestedKey, requestedKey, keyRewritten: false };
    }
    return {
        templateKey: TEMPLATE_KEY_FALLBACK,
        requestedKey,
        keyRewritten: requestedKey !== null,
    };
}

/** Human copy per send reason code (N2) — the raw code stays in the outbox row only. */
const SEND_ERROR_COPY: Record<string, string> = {
    "send-failed":
        "Couldn't reach the mail provider — nothing was sent. Retry or check provider settings.",
    "rate-capped": "Too many sends in the last minute — wait a moment, then retry.",
    skipped: "Send skipped — the recipient or template was not usable.",
    "binding-lookup-failed": "Couldn't read the send configuration — retry.",
    "condition-mismatch": "No binding fires for this design right now — check Bindings.",
    "no-enabled-binding": "No enabled binding exists for sending — hook one up in Bindings first.",
    "invalid-args": "Send request was invalid — retry.",
    "internal-error": "Something went wrong while sending — retry.",
};

function sendFailureCopy(reason: string | undefined): string {
    const copy = typeof reason === "string" ? SEND_ERROR_COPY[reason] : undefined;
    return copy ?? "Test send failed — retry or check provider settings.";
}

function saveChipCopy(status: DesignAutosaveStatus, dirty: boolean): string {
    if (status === "saving") return "Saving…";
    if (status === "error") return "Save failed";
    if (status === "saved") return "Saved";
    return dirty ? "Unsaved" : "Draft";
}

/** Export `reason:{id}` warnings that point at blocks still on the canvas. */
function warningTargetIds(
    message: string,
    nodes: Readonly<Record<string, CanvasNode>>,
): string[] {
    const ids: string[] = [];
    const pattern = /([a-z-]+):([A-Za-z0-9_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(message)) !== null) {
        const id = match[2];
        if (id && nodes[id] && !ids.includes(id)) ids.push(id);
    }
    return ids;
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
    dirty,
    device,
    onDeviceChange,
    propsOpen,
    onToggleProps,
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
    readonly dirty: boolean;
    readonly device: StudioDevice;
    readonly onDeviceChange: (next: StudioDevice) => void;
    readonly propsOpen: boolean;
    readonly onToggleProps: () => void;
}) {
    return (
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Mail aria-hidden="true" />
                </div>
                <Input
                    aria-label="Template name"
                    className="h-8 w-24 shrink border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input sm:w-56"
                    value={name}
                    onChange={(event) => onNameChange(event.target.value)}
                />
                <span
                    aria-live="polite"
                    className="badge-neutral hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex"
                >
                    {saveChipCopy(saveStatus, dirty)}
                </span>
            </div>

            <div className="hidden shrink-0 items-center sm:flex">
                <DeviceSwitch device={device} onChange={onDeviceChange} />
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <div className="hidden items-center sm:flex">
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
                <div className="flex items-center">
                    <Button
                        aria-label="Properties"
                        aria-pressed={propsOpen}
                        className="2xl:hidden"
                        size="icon-sm"
                        variant="ghost"
                        onClick={onToggleProps}
                    >
                        <SlidersHorizontal />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                    aria-label="Preview"
                    className="shrink-0 max-sm:px-2"
                    size="sm"
                    variant="outline"
                    onClick={onPreview}
                >
                    <Eye />
                    <span className="hidden sm:inline">Preview</span>
                </Button>
                <Button
                    aria-label="Send test"
                    className="shrink-0 max-sm:px-2"
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
                    className="shrink-0 max-sm:px-2"
                    disabled={saveStatus === "saving"}
                    size="sm"
                    title={saveStatus === "error" ? "Last save failed" : undefined}
                    onClick={onSave}
                >
                    <Save />
                    <span className="hidden min-[400px]:inline">{saveStatus === "saving" ? "Saving…" : "Save"}</span>
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
    device,
    onDeviceChange,
    exportNotes,
}: {
    readonly templateName: string;
    readonly onTemplateNameChange: (next: string) => void;
    readonly subject: string;
    readonly onSubjectChange: (next: string) => void;
    readonly device: StudioDevice;
    readonly onDeviceChange: (next: StudioDevice) => void;
    readonly exportNotes: string | null;
}) {
    const zoom = useCanvasDoc((state) => state.viewport.zoom);
    const setViewport = useCanvasDoc((state) => state.setViewport);
    const snapEnabled = useCanvasDoc((state) => state.snapEnabled);
    const setSnapEnabled = useCanvasDoc((state) => state.setSnapEnabled);
    const zoomPercent = Math.round(zoom * 100);

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

                <section className="flex flex-col gap-2.5">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Canvas
                    </h3>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground" id="settings-device-label">
                            Device
                        </span>
                        <div aria-labelledby="settings-device-label">
                            <DeviceSwitch device={device} onChange={onDeviceChange} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground" id="settings-zoom-label">
                            Zoom
                        </span>
                        <div aria-labelledby="settings-zoom-label" className="flex items-center gap-1">
                            <Button
                                aria-label="Zoom out"
                                disabled={zoom <= 0.5}
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setViewport({ zoom: clampZoom(zoom - ZOOM_STEP) })}
                            >
                                <ZoomOut />
                            </Button>
                            <span aria-live="polite" className="w-11 text-center text-xs tabular-nums text-foreground">
                                {zoomPercent}%
                            </span>
                            <Button
                                aria-label="Zoom in"
                                disabled={zoom >= 2}
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setViewport({ zoom: clampZoom(zoom + ZOOM_STEP) })}
                            >
                                <ZoomIn />
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-muted-foreground" htmlFor="settings-snap">
                            Snap to siblings
                        </Label>
                        <Switch
                            checked={snapEnabled}
                            id="settings-snap"
                            size="sm"
                            onCheckedChange={setSnapEnabled}
                        />
                    </div>
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Export notes
                    </h3>
                    <p aria-live="polite" className="text-[11px] leading-relaxed text-muted-foreground">
                        {exportNotes ?? "No warnings from the last save."}
                    </p>
                </section>
            </div>
        </aside>
    );
}

function StudioStatusStrip({ width }: { readonly width: number }) {
    const nodeCount = useCanvasDoc((state) => Object.keys(state.nodes).length);
    const selectionCount = useCanvasDoc((state) => state.selection.length);
    const zoom = useCanvasDoc((state) => state.viewport.zoom);
    const setViewport = useCanvasDoc((state) => state.setViewport);
    const zoomPercent = Math.round(zoom * 100);

    const handleZoomFit = useCallback((): void => {
        const scroll = document.querySelector("[data-studio-scroll]");
        const avail =
            (scroll instanceof HTMLElement ? scroll.clientWidth : width) - 32;
        useCanvasDoc.getState().setViewport({ zoom: clampZoom(avail / width) });
    }, [width]);

    return (
        <footer className="flex h-8 shrink-0 items-center justify-between border-t bg-card px-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
                <div aria-label="Canvas zoom" className="flex items-center gap-0.5" role="group">
                    <Button
                        aria-label="Zoom out"
                        className="size-6"
                        disabled={zoom <= 0.5}
                        size="icon"
                        variant="ghost"
                        onClick={() => setViewport({ zoom: clampZoom(zoom - ZOOM_STEP) })}
                    >
                        <ZoomOut />
                    </Button>
                    <button
                        aria-label={`${zoomPercent}%, activate to reset to 100 percent`}
                        className="w-11 rounded text-center tabular-nums transition-colors duration-150 hover:text-foreground"
                        type="button"
                        title="Reset zoom to 100%"
                        onClick={() => setViewport({ zoom: 1 })}
                    >
                        {zoomPercent}%
                    </button>
                    <Button
                        aria-label="Zoom in"
                        className="size-6"
                        disabled={zoom >= 2}
                        size="icon"
                        variant="ghost"
                        onClick={() => setViewport({ zoom: clampZoom(zoom + ZOOM_STEP) })}
                    >
                        <ZoomIn />
                    </Button>
                    <button
                        aria-label="Fit canvas width"
                        className="rounded px-1.5 py-0.5 transition-colors duration-150 hover:text-foreground"
                        type="button"
                        onClick={handleZoomFit}
                    >
                        Fit
                    </button>
                </div>
                <span aria-live="polite" className="tabular-nums">{width} px</span>
            </div>

            <div className="flex items-center gap-3">
                <span aria-live="polite" className="tabular-nums" data-testid="status-nodes">
                    {nodeCount} blocks
                </span>
                <span aria-live="polite" className="tabular-nums" data-testid="status-selection">
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
    templateName: "October benefits statement",
    subject: "October benefits statement",
} as const;

function useHistoryCounts(): { canUndo: boolean; canRedo: boolean } {
    const pastCount = useStore(useCanvasDoc.temporal, (state) => state.pastStates.length);
    const futureCount = useStore(useCanvasDoc.temporal, (state) => state.futureStates.length);
    return { canUndo: pastCount > 0, canRedo: futureCount > 0 };
}

function isActiveCatalogRow(row: MsCatalogRow): boolean {
    const flag: unknown = row.is_active;
    return flag === true || flag === 1 || flag === "1" || flag === "true";
}

function applyPreviewSample(
    baseHtml: string,
    baseWarnings: readonly string[],
    row: MsCatalogRow | null,
): { html: string; warnings: string[]; sampleKey: string | null } {
    if (!row) return { html: baseHtml, warnings: [...baseWarnings], sampleKey: null };
    const rendered = renderTemplate(baseHtml, {
        payload: extractPayloadExample(row.payload_example),
    });
    return {
        html: rendered.html,
        warnings: [...baseWarnings, ...rendered.warnings],
        sampleKey: row.event_key,
    };
}

const UNKNOWN_VAR_PREFIX = "unknown-var:";

function unknownTokenPaths(warnings: readonly string[]): string[] {
    return warnings
        .filter((warning) => warning.startsWith(UNKNOWN_VAR_PREFIX))
        .map((warning) => warning.slice(UNKNOWN_VAR_PREFIX.length))
        .filter((path, index, all) => path.length > 0 && all.indexOf(path) === index);
}

function formatPreviewTime(value: number | null): string | null {
    if (value === null) return null;
    return new Date(value).toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

/** Skeleton artboard shown while the saved design hydrates (N4). */
function StudioLoadingFallback() {
    return (
        <div
            className="flex min-h-0 w-full flex-1 flex-col bg-background"
            data-testid="hydrate-loading"
            role="status"
            aria-label="Loading design"
        >
            <div className="h-12 shrink-0 border-b bg-card" />
            <div className="flex min-h-0 flex-1">
                <div className="w-14 shrink-0 border-r bg-card" />
                <div className="flex min-w-0 flex-1 flex-col items-center px-4 py-8">
                    <div className="mb-3 h-5 w-16 animate-pulse rounded-full border bg-card" />
                    <div className="w-full max-w-[600px] shrink-0 animate-pulse rounded-xl border bg-card p-10 shadow-xl">
                        <div className="h-6 w-2/3 rounded bg-muted" />
                        <div className="mt-4 h-4 w-full rounded bg-muted" />
                        <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
                        <div className="mt-6 h-9 w-44 rounded-md bg-muted" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function StudioEditor() {
    const { templateKey, requestedKey, keyRewritten } = useTemplateKey();
    const [panel, setPanel] = useState<PanelId>("elements");
    const [device, setDevice] = useState<StudioDevice>("desktop");
    const [propsOpen, setPropsOpen] = useState(false);
    const [templateName, setTemplateName] = useState<string>(DEFAULT_DESIGN_META.templateName);
    const [subject, setSubject] = useState<string>(DEFAULT_DESIGN_META.subject);
    const [previewing, setPreviewing] = useState(false);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewWarnings, setPreviewWarnings] = useState<string[]>([]);
    const [previewSampleKey, setPreviewSampleKey] = useState<string | null>(null);
    const [previewCatalog, setPreviewCatalog] = useState<readonly MsCatalogRow[]>([]);
    const [previewEventKey, setPreviewEventKey] = useState<string | null>(null);
    const [previewCompiledAt, setPreviewCompiledAt] = useState<number | null>(null);
    const [previewDirtyDoc, setPreviewDirtyDoc] = useState(false);
    const [previewNoticesOpen, setPreviewNoticesOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const savedSelectionRef = useRef<string[]>([]);
    const previewDesignJsonRef = useRef<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sendOpen, setSendOpen] = useState(false);
    const [sendEmail, setSendEmail] = useState("");
    const [sendError, setSendError] = useState<string | null>(null);
    const [exportNotes, setExportNotes] = useState<string | null>(null);
    const [noteTargets, setNoteTargets] = useState<readonly string[]>([]);
    const [keyNotice, setKeyNotice] = useState<string | null>(null);
    const [hydrating, setHydrating] = useState(true);
    const invalidKeyToastedRef = useRef<string | null>(null);
    const missingKeyToastedRef = useRef<string | null>(null);
    const { canUndo, canRedo } = useHistoryCounts();

    const width = STUDIO_DEVICE_WIDTHS[device];

    const autosaveOptions = useMemo(
        () => ({
            templateKey,
            templateName,
            subject,
        }),
        [templateKey, templateName, subject],
    );
    const { save, status, error, dirty } = useDesignAutosave(autosaveOptions);

    useEffect(() => {
        let cancelled = false;
        setHydrating(true);
        setKeyNotice(null);
        (async () => {
            try {
                const row = await getDesign(templateKey);
                if (cancelled) return;
                if (keyRewritten && requestedKey && invalidKeyToastedRef.current !== requestedKey) {
                    invalidKeyToastedRef.current = requestedKey;
                    setKeyNotice(
                        `Unknown template key "${requestedKey}" — opened "${TEMPLATE_KEY_FALLBACK}" instead. Nothing was changed.`,
                    );
                    toast.error(
                        `Unknown template key "${requestedKey}" — opened "${TEMPLATE_KEY_FALLBACK}" instead. Nothing was changed.`,
                    );
                }
                if (row?.design_json) {
                    let parsed: unknown = null;
                    let parseOk = true;
                    try {
                        parsed = JSON.parse(row.design_json);
                    } catch {
                        parseOk = false;
                        toast.error("Saved design is corrupt — starting fresh.");
                    }
                    const result = parseOk ? canvasDocSchema.safeParse(parsed) : null;
                    if (!result || !result.success) {
                        if (parseOk) {
                            toast.error("Saved design failed validation — starting fresh.");
                        }
                        if (row.template_name) setTemplateName(row.template_name);
                        if (row.subject) setSubject(row.subject);
                        useCanvasDoc.getState().loadDoc({ nodes: {}, rootIds: [] });
                        return;
                    }
                    if (row.template_name) setTemplateName(row.template_name);
                    if (row.subject) setSubject(row.subject);
                    useCanvasDoc.getState().loadDoc({
                        nodes: result.data.nodes,
                        rootIds: result.data.rootIds,
                    });
                } else {
                    if (
                        requestedKey !== null &&
                        !keyRewritten &&
                        missingKeyToastedRef.current !== templateKey
                    ) {
                        missingKeyToastedRef.current = templateKey;
                        setKeyNotice(
                            `No template found for "${templateKey}" — starting fresh. Saving will create it.`,
                        );
                        toast.info(
                            `No template found for "${templateKey}" — starting fresh. Saving will create it.`,
                        );
                    }
                    useCanvasDoc.getState().loadDoc({ nodes: {}, rootIds: [] });
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
    }, [templateKey, requestedKey, keyRewritten]);

    // N1 regression probe: the send portal mounts only while open, so after a
    // close no dialog overlay may remain. In dev, verify one tick later and
    // report loudly; the re-QA lane asserts elementsFromPoint live.
    const sendOpenPrevRef = useRef(sendOpen);
    useEffect(() => {
        const wasOpen = sendOpenPrevRef.current;
        sendOpenPrevRef.current = sendOpen;
        if (!wasOpen || sendOpen || process.env.NODE_ENV === "production") return;
        const timer = window.setTimeout(() => {
            if (document.querySelector('[data-slot="dialog-overlay"]')) {
                console.error(
                    "[mailing-studio] dialog overlay outlived close — pointer input may be blocked.",
                );
            }
        }, 350);
        return () => window.clearTimeout(timer);
    }, [sendOpen]);

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
        const { ok, message: saveMessage } = await save();
        if (!ok) return;
        toast.success("Design saved.");
        if (saveMessage) {
            setExportNotes(saveMessage);
            setNoteTargets(
                warningTargetIds(saveMessage, useCanvasDoc.getState().nodes),
            );
        }
    }, [save]);

    // Preview = compiled receiver output. Snapshots the LIVE doc in-memory
    // (never saves), clears editor selection so no rings/handles persist, then
    // compiles through the real export path. The request carries the
    // preview-level event key, so the route sample-resolves {{tokens}} through
    // the dispatch renderer against that event's payload_example (D3) —
    // unknown paths warn unknown-var:* and render empty, exactly as a send
    // would emit. The frame always shows the latest compile (keyed remount on
    // every resolve); a freshness strip names the dirty state and the compile
    // time so staleness is stated, not silent. Switching the sample event
    // re-compiles through the route — the selector resolves, not decorates.
    // The preview tree mounts NO
    // StageCanvas/Moveable — just an isolated iframe of the export HTML.
    const compilePreview = useCallback(
        async (
            designJson: string,
            eventKey: string | null,
            rows: readonly MsCatalogRow[],
        ): Promise<void> => {
            setPreviewLoading(true);
            setPreviewError(null);
            try {
                const result = await previewDesign(designJson, subject, eventKey);
                if (result.sampleKey) {
                    setPreviewHtml(result.html);
                    setPreviewWarnings(result.warnings);
                    setPreviewSampleKey(result.sampleKey);
                } else {
                    const pick =
                        (eventKey
                            ? rows.find((row) => row.event_key === eventKey)
                            : undefined) ?? null;
                    const applied = applyPreviewSample(result.html, result.warnings, pick);
                    setPreviewHtml(applied.html);
                    setPreviewWarnings(applied.warnings);
                    setPreviewSampleKey(applied.sampleKey);
                }
                setPreviewCompiledAt(Date.now());
            } catch (cause) {
                setPreviewError(cause instanceof Error ? cause.message : "Preview failed");
            } finally {
                setPreviewLoading(false);
            }
        },
        [subject],
    );

    const handlePreview = useCallback(async (): Promise<void> => {
        const store = useCanvasDoc.getState();
        savedSelectionRef.current = [...store.selection];
        store.selectNodes([]);
        const designJson = JSON.stringify({
            version: 1,
            width: 600,
            nodes: store.nodes,
            rootIds: store.rootIds,
        });
        previewDesignJsonRef.current = designJson;
        setPreviewDirtyDoc(dirty);
        setPreviewing(true);
        setPreviewLoading(true);
        setPreviewError(null);
        setPreviewHtml(null);
        setPreviewWarnings([]);
        setPreviewSampleKey(null);
        setPreviewNoticesOpen(false);
        setPreviewCompiledAt(null);
        try {
            let rows: MsCatalogRow[] = [];
            try {
                const fetched = await fetchMsCatalog({ is_active: true });
                rows = fetched.filter(isActiveCatalogRow).sort((a, b) =>
                    a.event_key.localeCompare(b.event_key),
                );
            } catch {
                rows = [];
            }
            setPreviewCatalog(rows);
            const pick =
                (previewEventKey
                    ? rows.find((row) => row.event_key === previewEventKey)
                    : undefined) ??
                rows[0] ??
                null;
            setPreviewEventKey(pick?.event_key ?? null);
            await compilePreview(designJson, pick?.event_key ?? null, rows);
        } catch (cause) {
            setPreviewError(cause instanceof Error ? cause.message : "Preview failed");
            setPreviewLoading(false);
        }
    }, [previewEventKey, dirty, compilePreview]);

    const handlePreviewSampleChange = useCallback(
        (nextKey: string | null): void => {
            setPreviewEventKey(nextKey);
            const designJson = previewDesignJsonRef.current;
            if (designJson === null) return;
            void compilePreview(designJson, nextKey, previewCatalog);
        },
        [compilePreview, previewCatalog],
    );

    // Exit restores the exact pre-preview editor state (selection included)
    // and returns focus to the control that opened preview.
    const handleExitPreview = useCallback((): void => {
        setPreviewing(false);
        setPreviewHtml(null);
        setPreviewWarnings([]);
        setPreviewSampleKey(null);
        setPreviewError(null);
        setPreviewLoading(false);
        setPreviewCatalog([]);
        setPreviewCompiledAt(null);
        setPreviewNoticesOpen(false);
        previewDesignJsonRef.current = null;
        const saved = savedSelectionRef.current;
        if (saved.length > 0) useCanvasDoc.getState().selectNodes(saved);
        savedSelectionRef.current = [];
        requestAnimationFrame(() => {
            const next = document.querySelector('button[aria-label="Preview"]');
            if (next instanceof HTMLElement) next.focus();
        });
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void handleSave();
                return;
            }
            if (event.key === "Escape" && previewing) {
                handleExitPreview();
                return;
            }
            if (event.key === "Escape" && propsOpen) {
                setPropsOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleSave, propsOpen, previewing, handleExitPreview]);

    const handleSendOpenChange = useCallback((open: boolean): void => {
        setSendOpen(open);
        if (!open) setSendError(null);
    }, []);

    // Send test = compile the LIVE doc in-memory (never saves), then send the
    // compiled output through the existing dry_run dispatch path (send-only
    // overrides — the template row is never rewritten, nothing is emailed).
    // Template identity is a read-only getDesign lookup; a never-saved design
    // has no id to address, so the run fails honestly with an error toast
    // instead of forcing a save. Failures render inline (role=alert) with
    // human copy — the raw reason code stays in the outbox row only (N2).
    const handleSendTest = useCallback(async (): Promise<void> => {
        const toEmail = sendEmail.trim();
        if (!EMAIL_PATTERN.test(toEmail)) {
            setSendError("Enter a valid recipient email for the test send.");
            return;
        }
        if (sending) return;
        setSending(true);
        setSendError(null);
        try {
            const store = useCanvasDoc.getState();
            const design_json = JSON.stringify({
                version: 1,
                width: 600,
                nodes: store.nodes,
                rootIds: store.rootIds,
            });
            const compiled = await previewDesign(design_json, subject);
            const row = await getDesign(templateKey);
            if (row?.id === undefined || row.id === null) {
                throw new Error("Save your design once before sending a test.");
            }
            const result = await sendCompiledTest({
                template_id: row.id,
                to_email: toEmail,
                subject,
                body_html: compiled.html,
            });
            if (!result.ok) {
                throw new Error(sendFailureCopy(result.reason));
            }
            toast.success("Test send recorded — check Outbox for status.");
            setSendOpen(false);
        } catch (cause) {
            const copy = cause instanceof Error ? cause.message : "Test send failed";
            setSendError(copy);
            toast.error(copy);
        } finally {
            setSending(false);
        }
    }, [sendEmail, sending, subject, templateKey]);

    if (hydrating) {
        return <StudioLoadingFallback />;
    }

    if (previewing) {
        const unknownTokens = unknownTokenPaths(previewWarnings);
        const compiledTime = formatPreviewTime(previewCompiledAt);
        const sampleOptions = previewCatalog.map((row) => ({
            value: row.event_key,
            label: row.event_key,
        }));
        return (
            <div className="flex min-h-0 w-full flex-1 flex-col bg-background">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        Preview — receiver view
                    </span>
                    {previewCatalog.length > 0 ? (
                        <div className="flex w-40 shrink-0 items-center gap-1.5 sm:w-48">
                            <Label
                                className="hidden shrink-0 text-[11px] font-medium text-muted-foreground lg:inline"
                                htmlFor="preview-sample-event"
                            >
                                Sample data:
                            </Label>
                            <MsCombobox
                                ariaLabel="Preview sample data from event"
                                disabled={previewLoading}
                                emptyText="No events found."
                                id="preview-sample-event"
                                options={sampleOptions}
                                placeholder="Sample event"
                                searchPlaceholder="Search events…"
                                value={previewEventKey ?? ""}
                                onValueChange={(next) =>
                                    handlePreviewSampleChange(next === "" ? null : next)
                                }
                            />
                        </div>
                    ) : null}
                    {previewSampleKey ? (
                        <span
                            className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex"
                            data-testid="preview-sample"
                            title={`Resolved against ${previewSampleKey}`}
                        >
                            Sample: {previewSampleKey}
                        </span>
                    ) : null}
                    {previewWarnings.length > 0 ? (
                        <button
                            aria-expanded={previewNoticesOpen}
                            aria-label={`${previewWarnings.length} export notices, activate to ${previewNoticesOpen ? "hide" : "show"}`}
                            className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
                            data-testid="preview-warnings"
                            type="button"
                            onClick={() => setPreviewNoticesOpen((open) => !open)}
                        >
                            {previewWarnings.length} export notice
                            {previewWarnings.length === 1 ? "" : "s"}
                            <ChevronDown
                                aria-hidden="true"
                                className={cn(
                                    "size-3 transition-transform duration-150",
                                    previewNoticesOpen ? "rotate-180" : undefined,
                                )}
                            />
                        </button>
                    ) : null}
                    <Button
                        aria-label="Exit preview"
                        className="shrink-0 max-sm:px-2"
                        size="sm"
                        variant="outline"
                        onClick={handleExitPreview}
                    >
                        <X />
                        <span className="hidden sm:inline">Exit preview</span>
                    </Button>
                </header>
                <div
                    className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
                    data-testid="preview-freshness"
                    role="status"
                >
                    <span>
                        {previewDirtyDoc
                            ? "Unsaved changes — previewing the current canvas, not the last save."
                            : "Previewing the current canvas."}
                    </span>
                    {compiledTime ? (
                        <span className="tabular-nums">Compiled {compiledTime}.</span>
                    ) : null}
                    {previewLoading && previewHtml ? (
                        <span className="tabular-nums">Recompiling…</span>
                    ) : null}
                    {!previewLoading && !previewSampleKey && previewHtml ? (
                        <span>No sample event — tokens shown raw.</span>
                    ) : null}
                </div>
                {previewNoticesOpen && previewWarnings.length > 0 ? (
                    <div className="max-h-40 shrink-0 overflow-y-auto border-b bg-card px-3 py-2">
                        <ul className="flex flex-col gap-1" data-testid="preview-notices">
                            {previewWarnings.map((warning) =>
                                warning.startsWith(UNKNOWN_VAR_PREFIX) ? (
                                    <li
                                        className="text-[11px] leading-relaxed text-muted-foreground"
                                        key={warning}
                                    >
                                        Unresolved token{" "}
                                        <code className="rounded bg-muted px-1 tabular-nums">
                                            {`{{${warning.slice(UNKNOWN_VAR_PREFIX.length)}}}`}
                                        </code>{" "}
                                        — not in
                                        {previewSampleKey ? ` ${previewSampleKey}` : ""} sample
                                        data; renders empty to the recipient.
                                    </li>
                                ) : (
                                    <li
                                        className="text-[11px] leading-relaxed text-muted-foreground tabular-nums"
                                        key={warning}
                                    >
                                        {warning}
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                ) : null}
                {unknownTokens.length > 0 && !previewNoticesOpen ? (
                    <div
                        className="shrink-0 border-b bg-card px-3 py-1.5 text-[11px] text-muted-foreground"
                        data-testid="preview-unresolved"
                        role="status"
                    >
                        Unresolved token{unknownTokens.length === 1 ? "" : "s"}{" "}
                        {unknownTokens.slice(0, 3).map((path) => `{{${path}}}`).join(", ")}
                        {unknownTokens.length > 3
                            ? ` +${unknownTokens.length - 3} more`
                            : ""}{" "}
                        — renders empty to the recipient.
                    </div>
                ) : null}
                <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8 sm:px-6">
                    <span className="mb-3 shrink-0 rounded-full border bg-card px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm tabular-nums">
                        {width} px
                    </span>
                    {previewLoading && !previewHtml ? (
                        <div
                            className="flex items-center justify-center py-16"
                            data-testid="preview-loading"
                            role="status"
                        >
                            <span className="text-sm text-muted-foreground">
                                Compiling preview…
                            </span>
                        </div>
                    ) : previewError && !previewHtml ? (
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
                            aria-busy={previewLoading}
                            className="w-full shrink-0 overflow-hidden rounded-xl border bg-card shadow-xl dark:shadow-black/50"
                            data-testid="email-preview"
                            style={{ maxWidth: width }}
                        >
                            <iframe
                                key={previewCompiledAt ?? "initial"}
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
                device={device}
                dirty={dirty}
                name={templateName}
                propsOpen={propsOpen}
                saveStatus={status}
                sending={sending}
                onDeviceChange={setDevice}
                onNameChange={setTemplateName}
                onPreview={() => void handlePreview()}
                onRedo={() => useCanvasDoc.getState().redo()}
                onSave={() => void handleSave()}
                onSendTest={() => setSendOpen(true)}
                onToggleProps={() => setPropsOpen((open) => !open)}
                onUndo={() => useCanvasDoc.getState().undo()}
            />
            {keyNotice ? (
                <div
                    className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2 text-xs"
                    role="status"
                >
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {keyNotice}
                    </span>
                    <Button
                        aria-label="Dismiss template key notice"
                        className="shrink-0"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setKeyNotice(null)}
                    >
                        <X />
                    </Button>
                </div>
            ) : null}
            {exportNotes ? (
                <div
                    className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2 text-xs"
                    role="status"
                >
                    <span className="shrink-0 font-medium text-foreground">Export notes</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {exportNotes}
                    </span>
                    {noteTargets.map((id) => (
                        <button
                            aria-label={`Show block ${id}`}
                            className="shrink-0 rounded px-1.5 py-0.5 text-muted-foreground transition-colors duration-150 hover:text-primary hover:underline"
                            key={id}
                            type="button"
                            onClick={() => useCanvasDoc.getState().selectNodes([id])}
                        >
                            Show
                        </button>
                    ))}
                    <Button
                        aria-label="Dismiss export notes"
                        className="shrink-0"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                            setExportNotes(null);
                            setNoteTargets([]);
                        }}
                    >
                        <X />
                    </Button>
                </div>
            ) : null}
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
                        device={device}
                        exportNotes={exportNotes}
                        subject={subject}
                        templateName={templateName}
                        onDeviceChange={setDevice}
                        onSubjectChange={setSubject}
                        onTemplateNameChange={setTemplateName}
                    />
                ) : null}
                {panel === "help" ? <HelpPanel /> : null}
                <StageCanvas width={width} onEmptyAdd={() => setPanel("elements")} />
                <PropertyPanel />
                {propsOpen ? (
                    <div className="fixed inset-0 z-40 2xl:hidden">
                        <button
                            aria-label="Close properties"
                            className="absolute inset-0 bg-background/60"
                            type="button"
                            onClick={() => setPropsOpen(false)}
                        />
                        <div className="absolute bottom-0 right-0 top-0 flex max-h-[100dvh] w-[280px] flex-col overflow-hidden border-l bg-card shadow-xl">
                            <PropertyPanel sheet />
                        </div>
                    </div>
                ) : null}
            </div>
            <StudioStatusStrip width={width} />
            <Dialog open={sendOpen} onOpenChange={handleSendOpenChange}>
                {sendOpen ? (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Send test</DialogTitle>
                            <DialogDescription>
                                Compiles the live canvas — unsaved edits included —
                                and records a dry-run. Nothing is emailed.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-medium text-muted-foreground" htmlFor="send-test-email">
                                Recipient
                            </Label>
                            <Input
                                aria-label="Test recipient email"
                                className="h-8 text-xs"
                                id="send-test-email"
                                inputMode="email"
                                placeholder="you@example.com"
                                value={sendEmail}
                                onChange={(event) => {
                                    setSendEmail(event.target.value);
                                    setSendError(null);
                                }}
                            />
                            {sendError ? (
                                <p className="text-xs leading-relaxed text-destructive" role="alert">
                                    {sendError}
                                </p>
                            ) : null}
                        </div>
                        <DialogFooter>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSendOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                aria-label="Send test now"
                                disabled={sending}
                                size="sm"
                                onClick={() => void handleSendTest()}
                            >
                                <Send />
                                {sending ? "Sending…" : "Send test"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                ) : null}
            </Dialog>
        </div>
    );
}

export function MailingStudioPage() {
    return (
        <Suspense fallback={<StudioLoadingFallback />}>
            <StudioEditor />
        </Suspense>
    );
}
