"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand";
import { ArrowLeft, Loader2, Redo2, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ID_CARD, idDocSchema } from "../types/id-layout.schema";
import { clampIdZoom, createIdDocStore, ID_ZOOM_MAX, ID_ZOOM_MIN, ID_ZOOM_STEP } from "../engine/store";
import { ID_SURFACE, IdStageCanvas } from "../engine/IdStageCanvas";
import { ID_SAMPLE_USER, blankIdDoc, parseIdDesignJson } from "./idSample";
import { getIdTemplate, isActiveFlag, patchIdTemplate } from "./idApi";
import { ID_PALETTE_MIME, IdPalette, insertPaletteNode } from "./IdPalette";
import type { IdPaletteDnD } from "./IdPalette";
import { IdLayersPanel } from "./IdLayersPanel";
import { IdPropertyPanel } from "./IdPropertyPanel";

type IdInspectorTab = "props" | "layers";
type IdMobileTab = "components" | "canvas" | "inspector";

function normaliseDesignJson(value: unknown): string {
    try {
        return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value);
    } catch {
        return "";
    }
}

export function IdEditor({ templateId }: { readonly templateId: string }) {
    const [store] = useState(() => createIdDocStore());
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [templateName, setTemplateName] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [activeBusy, setActiveBusy] = useState(false);
    const [savedVersion, setSavedVersion] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<IdInspectorTab>("props");
    const [mobileTab, setMobileTab] = useState<IdMobileTab>("canvas");

    const nodes = store((state) => state.nodes);
    const version = store((state) => state.version);
    const zoom = store((state) => state.viewport.zoom);
    const setViewport = store((state) => state.setViewport);
    const snapEnabled = store((state) => state.snapEnabled);
    const setSnapEnabled = store((state) => state.setSnapEnabled);
    const undo = store((state) => state.undo);
    const redo = store((state) => state.redo);
    const pastCount = useStore(store.temporal, (state) => state.pastStates.length);
    const futureCount = useStore(store.temporal, (state) => state.futureStates.length);

    const load = useCallback(async (): Promise<void> => {
        setStatus("loading");
        setLoadError(null);
        try {
            const row = await getIdTemplate(templateId);
            if (!row) {
                setLoadError("No template found for this id.");
                setStatus("error");
                return;
            }
            setTemplateName(row.name);
            setIsActive(isActiveFlag(row.is_active));
            const parsed = parseIdDesignJson(row.design_json) ?? blankIdDoc();
            const result = idDocSchema.safeParse(parsed);
            if (!result.success) {
                toast.error("Saved design failed validation — starting from a blank card.");
                store.getState().loadDoc(blankIdDoc());
            } else {
                store.getState().loadDoc(result.data);
            }
            setSavedVersion(store.getState().version);
            setStatus("ready");
        } catch (cause) {
            setLoadError(cause instanceof Error ? cause.message : "Failed to load the template.");
            setStatus("error");
        }
    }, [store, templateId]);

    useEffect(() => {
        void load();
    }, [load]);

    const dirty = savedVersion !== null && version !== savedVersion;

    const overflowIds = Object.values(nodes)
        .filter((node) => node.x < 0 || node.y < 0 || node.x + node.w > ID_CARD.width || node.y + node.h > ID_CARD.height)
        .map((node) => node.id);

    const handleSave = useCallback(async (): Promise<void> => {
        const state = store.getState();
        const doc = { version: 2, card: { width: ID_CARD.width, height: ID_CARD.height }, pages: state.pages, nodes: state.nodes };
        const parsed = idDocSchema.safeParse(doc);
        if (!parsed.success) {
            toast.error(parsed.error.issues[0]?.message ?? "Design failed validation.");
            return;
        }
        setSaving(true);
        try {
            const row = await patchIdTemplate(templateId, {
                design_json: parsed.data,
            });
            const verify = await getIdTemplate(templateId);
            const verified = verify !== null && normaliseDesignJson(verify.design_json) === normaliseDesignJson(row.design_json ?? parsed.data);
            if (!verified) {
                toast.error("Save verification failed — please reload and try again.");
                return;
            }
            setSavedVersion(store.getState().version);
            toast.success("Template saved.");
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Save failed.");
        } finally {
            setSaving(false);
        }
    }, [store, templateId]);

    const handleToggleActive = useCallback(async (next: boolean): Promise<void> => {
        setActiveBusy(true);
        try {
            await patchIdTemplate(templateId, { is_active: next });
            setIsActive(next);
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "Could not update the template.");
        } finally {
            setActiveBusy(false);
        }
    }, [templateId]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void handleSave();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [handleSave]);

    const handleDrop = useCallback(
        (event: React.DragEvent<HTMLDivElement>): void => {
            const raw = event.dataTransfer.getData(ID_PALETTE_MIME);
            if (!raw) return;
            event.preventDefault();
            let payload: IdPaletteDnD;
            try {
                payload = JSON.parse(raw) as IdPaletteDnD;
            } catch {
                return;
            }
            if (!payload || typeof payload.kind !== "string") return;
            const state = store.getState();
            const currentZoom = state.viewport.zoom || 1;
            const host = event.currentTarget;
            let at: { x: number; y: number } | undefined;
            let dropPageId: string | undefined;
            const blocks = host.querySelectorAll("[data-id-card-block]");
            for (const block of Array.from(blocks)) {
                if (!(block instanceof HTMLElement)) continue;
                const rect = block.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
                    continue;
                }
                const side = block.getAttribute("data-id-card-block");
                dropPageId = state.pages.find((page) => page.side === side)?.id;
                at = {
                    x: Math.max(0, (event.clientX - rect.left) / currentZoom - 60),
                    y: Math.max(0, (event.clientY - rect.top) / currentZoom - 20),
                };
                break;
            }
            insertPaletteNode(store, payload, at, dropPageId);
        },
        [store],
    );

    const dropHandlers = {
        onDragOver: (event: React.DragEvent<HTMLDivElement>): void => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
        },
        onDrop: handleDrop,
    };

    const zoomPercent = Math.round(zoom * 100);

    const handleZoomFit = useCallback((): void => {
        const scroll = document.querySelector("[data-id-studio-scroll]");
        const avail = (scroll instanceof HTMLElement ? scroll.clientWidth : ID_SURFACE.width) - 32;
        setViewport({ zoom: clampIdZoom(avail / ID_SURFACE.width) });
    }, [setViewport]);

    if (status === "loading") {
        return (
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3" role="status" aria-label="Loading template">
                <Loader2 aria-hidden="true" className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading template…</p>
            </div>
        );
    }

    if (status === "error") {
        return (
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
                <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-lg border bg-card px-4 py-16 text-center">
                    <p className="text-sm text-muted-foreground">{loadError ?? "Could not load that template."}</p>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button>
                        <Button size="sm" asChild>
                            <Link href="/hrm/id-layout">Back to templates</Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const inspector = (
        <div className="flex min-h-0 w-full flex-1 flex-col">
            <div aria-label="Inspector" className="flex shrink-0 items-center gap-1 border-b p-2" role="tablist">
                <Button aria-selected={inspectorTab === "props"} role="tab" className="flex-1" size="sm" variant={inspectorTab === "props" ? "secondary" : "ghost"} onClick={() => setInspectorTab("props")}>Properties</Button>
                <Button aria-selected={inspectorTab === "layers"} role="tab" className="flex-1" size="sm" variant={inspectorTab === "layers" ? "secondary" : "ghost"} onClick={() => setInspectorTab("layers")}>Layers</Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {inspectorTab === "props" ? <IdPropertyPanel store={store} /> : <IdLayersPanel store={store} />}
            </div>
        </div>
    );

    const workspace = (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" {...dropHandlers}>
            <IdStageCanvas store={store} values={ID_SAMPLE_USER} />
        </div>
    );

    return (
        <div className="flex min-h-0 w-full flex-1 flex-col bg-background">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-3">
                <Button aria-label="Back to templates" size="icon-sm" variant="ghost" asChild>
                    <Link href="/hrm/id-layout"><ArrowLeft /></Link>
                </Button>
                <span className="max-w-32 truncate px-2 text-sm font-medium sm:max-w-56" title={templateName}>{templateName}</span>
                <span aria-live="polite" className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                    {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
                    <Button aria-label="Undo" disabled={pastCount === 0} size="icon-sm" variant="ghost" onClick={() => undo()}><Undo2 /></Button>
                    <Button aria-label="Redo" disabled={futureCount === 0} size="icon-sm" variant="ghost" onClick={() => redo()}><Redo2 /></Button>
                    <Button aria-label="Zoom out" disabled={zoom <= ID_ZOOM_MIN} size="icon-sm" variant="ghost" onClick={() => setViewport({ zoom: clampIdZoom(zoom - ID_ZOOM_STEP) })}><ZoomOut /></Button>
                    <Button
                        aria-label={`${zoomPercent}%, activate to reset to 100 percent`}
                        aria-live="polite"
                        className="hidden w-11 px-1 text-xs tabular-nums sm:inline-flex"
                        size="sm"
                        title="Reset zoom to 100%"
                        type="button"
                        variant="ghost"
                        onClick={() => setViewport({ zoom: 1 })}
                    >
                        {zoomPercent}%
                    </Button>
                    <Button aria-label="Zoom in" disabled={zoom >= ID_ZOOM_MAX} size="icon-sm" variant="ghost" onClick={() => setViewport({ zoom: clampIdZoom(zoom + ID_ZOOM_STEP) })}><ZoomIn /></Button>
                    <Button
                        aria-label="Fit canvas width"
                        className="px-2 text-xs"
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={handleZoomFit}
                    >
                        Fit
                    </Button>
                    <Button aria-label="Save template" className="shrink-0 max-sm:px-2" disabled={saving} size="sm" onClick={() => void handleSave()}>
                        {saving ? <Loader2 className="animate-spin" /> : <Save />}
                        <span className="hidden min-[400px]:inline">{saving ? "Saving…" : "Save"}</span>
                    </Button>
                </div>
            </header>
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="id-template-active">Active</Label>
                    <Switch checked={isActive} disabled={activeBusy} id="id-template-active" size="sm" onCheckedChange={(next) => void handleToggleActive(next)} />
                </div>
                <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium text-muted-foreground" htmlFor="id-template-snap">Snapping</Label>
                    <Switch checked={snapEnabled} id="id-template-snap" size="sm" onCheckedChange={setSnapEnabled} />
                </div>
                {overflowIds.length > 0 ? (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400" role="alert">
                        {overflowIds.length} block{overflowIds.length === 1 ? "" : "s"} past the card edge: {overflowIds.slice(0, 6).join(", ")}{overflowIds.length > 6 ? ` +${overflowIds.length - 6} more` : ""}
                    </p>
                ) : null}
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="hidden shrink-0 md:block">
                    <IdPalette store={store} />
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <div aria-label="Editor view" className="flex shrink-0 items-center gap-1 border-b bg-card p-2 md:hidden" role="tablist">
                        {([
                            { value: "components", label: "Components" },
                            { value: "canvas", label: "Canvas" },
                            { value: "inspector", label: "Inspector" },
                        ] as const).map((tab) => (
                            <Button aria-selected={mobileTab === tab.value} role="tab" className={cn("flex-1")} key={tab.value} size="sm" variant={mobileTab === tab.value ? "secondary" : "ghost"} onClick={() => setMobileTab(tab.value)}>{tab.label}</Button>
                        ))}
                    </div>
                    <div className={mobileTab === "components" ? "min-h-0 flex-1 overflow-y-auto md:hidden" : "hidden"}>
                        <IdPalette store={store} />
                    </div>
                    <div className={mobileTab === "inspector" ? "flex min-h-0 flex-1 flex-col overflow-hidden md:hidden" : "hidden"}>
                        {inspector}
                    </div>
                    <div className={mobileTab === "canvas" ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "hidden min-h-0 flex-1 flex-col overflow-hidden md:flex"}>
                        {workspace}
                    </div>
                </div>
                <div className="hidden w-[280px] shrink-0 flex-col border-l bg-card lg:flex">
                    {inspector}
                </div>
            </div>
        </div>
    );
}
