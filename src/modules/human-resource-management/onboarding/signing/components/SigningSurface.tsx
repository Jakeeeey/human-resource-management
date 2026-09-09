"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
// THE validity predicate — imported from Todo 6, never redefined here.
import { isPaperworkValid } from "../../paperwork/paperworkValidity";
import type { InkCanvasHandle } from "../InkCanvas";
import type { SigningInk, SigningStroke } from "../signingStrokes";
import { mergeStampsIntoInk } from "../signingStamps";
import type {
  SigningEnvelope,
  SigningEnvelopeContent,
  SigningStamp,
} from "../types/signing-envelope.schema";
import { useSigningEnvelopeFetch } from "../providers/signingEnvelopeProvider";
import { SIGNING_PAGE_H, SIGNING_PAGE_W, TemplatePageView } from "./TemplatePageView";
import { SignatureStampPicker, type CapturedStamp } from "./SignatureStampPicker";
import { SigningFilingPanel } from "./SigningFilingPanel";

// SigningSurface.tsx — full-viewport tablet signing surface (Todo 7):
// template HTML pages rendered 1:1 with per-page `InkCanvas` overlay (exact
// alignment — our DOM, no plugin), signature tap-to-stamp (captured pad →
// PNG stamp at tap point, draggable before confirm), Finish gated SOLELY on
// the Todo 6 validity predicate. Explicit Save-draft (server-persisted
// strokes, resumable) vs Finish (locks envelope, routes to Todo 8). Touch
// targets ≥32px (min-h-8/min-w-8); works at 820px tablet width + 375px.

export interface SigningActor {
  role: "hiree" | "hr";
  profile_id: number | null;
}

interface PlacedStamp extends SigningStamp {
  pngUrl?: string;
}

interface SigningSurfaceProps {
  template: PaperworkTemplate;
  envelope: SigningEnvelope;
  actor: SigningActor;
  onEnvelopeChange?: (envelope: SigningEnvelope) => void;
}

function pageCountFor(template: PaperworkTemplate): number {
  const zones = template.zones ?? [];
  return Math.max(1, ...zones.map((zone) => zone.page), 1);
}

function parseContent(raw: string | null): SigningEnvelopeContent | null {
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as SigningEnvelopeContent;
    if (!parsed || typeof parsed !== "object" || !("ink" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function SigningSurface({ template, envelope, actor, onEnvelopeChange }: SigningSurfaceProps) {
  const { saveDraft, finishEnvelope, getEnvelope } = useSigningEnvelopeFetch();
  const pageCount = useMemo(() => pageCountFor(template), [template]);
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i + 1), [pageCount]);

  const initial = useMemo(() => parseContent(envelope.strokes), [envelope.strokes]);
  const [inkPages, setInkPages] = useState<Record<number, SigningStroke[]>>(() => {
    const seed: Record<number, SigningStroke[]> = {};
    const contentInk = initial?.ink as SigningInk | undefined;
    for (const page of pages) {
      const found = contentInk?.pages?.find((entry) => entry?.page === page);
      seed[page] = Array.isArray(found?.strokes) ? found.strokes : [];
    }
    return seed;
  });
  const [stamps, setStamps] = useState<PlacedStamp[]>(() => initial?.stamps ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStamp, setPendingStamp] = useState<CapturedStamp | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const canvasHandles = useRef<Record<number, InkCanvasHandle | null>>({});
  const pagesRef = useRef<HTMLDivElement | null>(null);

  const locked = envelope.status === "finished";

  // Same-origin rendered page boxes in page order — the Todo 8 flatten
  // worker captures these with the REAL `html-to-image.toPng` call.
  const getPageNodes = useCallback((): HTMLElement[] => {
    const root = pagesRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>("[data-signing-page-box]")
    ).sort(
      (a, b) =>
        Number(a.getAttribute("data-signing-page-box") ?? 0) -
        Number(b.getAttribute("data-signing-page-box") ?? 0)
    );
  }, []);

  const ink: SigningInk = useMemo(
    () => ({
      pages: pages.map((page) => ({ page, strokes: inkPages[page] ?? [] })),
    }),
    [pages, inkPages]
  );

  const pageSizes = useMemo(() => {
    const sizes: Record<number, { width: number; height: number }> = {};
    for (const page of pages) sizes[page] = { width: SIGNING_PAGE_W, height: SIGNING_PAGE_H };
    return sizes;
  }, [pages]);

  // Merged ink (freehand + translated stamps) is what the predicate sees —
  // the SAME merge the server recomputes at Finish time.
  const merged = useMemo(
    () => mergeStampsIntoInk(ink, stamps, pageSizes),
    [ink, stamps, pageSizes]
  );
  const verdict = useMemo(
    () => isPaperworkValid(template.zones ?? [], merged, pageSizes),
    [template.zones, merged, pageSizes]
  );

  const handleFiled = useCallback(async () => {
    try {
      const refreshed = await getEnvelope(envelope.id);
      if (refreshed) onEnvelopeChange?.(refreshed);
    } catch {
      // Panel already toasted success; refresh is best-effort.
    }
  }, [getEnvelope, envelope.id, onEnvelopeChange]);

  const registerCanvas = useCallback((page: number, handle: InkCanvasHandle | null) => {
    canvasHandles.current[page] = handle;
  }, []);

  const handleStrokesChange = useCallback((page: number, strokes: SigningStroke[]) => {
    setInkPages((prev) => ({ ...prev, [page]: strokes }));
  }, []);

  const handleTapPlace = useCallback(
    (page: number, x: number, y: number) => {
      if (!pendingStamp) return;
      const stamp: PlacedStamp = {
        id: `stamp-${Date.now().toString(36)}-${stamps.length + 1}`,
        page,
        x,
        y,
        strokes: pendingStamp.strokes,
        pngUrl: pendingStamp.pngUrl,
      };
      setStamps((prev) => [...prev, stamp]);
      setSelectedStampId(stamp.id);
    },
    [pendingStamp, stamps.length]
  );

  const handleStampMove = useCallback((id: string, x: number, y: number) => {
    setStamps((prev) => prev.map((stamp) => (stamp.id === id ? { ...stamp, x, y } : stamp)));
  }, []);

  const handleStampDelete = useCallback((id: string) => {
    setStamps((prev) => prev.filter((stamp) => stamp.id !== id));
    setSelectedStampId((cur) => (cur === id ? null : cur));
  }, []);

  const handleCapture = useCallback((captured: CapturedStamp) => {
    setPendingStamp(captured);
    setPickerOpen(false);
    toast.success("Stamp captured — tap a page to place it");
  }, []);

  const serializableStamps = useCallback(
    (): SigningStamp[] =>
      stamps.map((stamp) => ({
        id: stamp.id,
        page: stamp.page,
        x: stamp.x,
        y: stamp.y,
        strokes: stamp.strokes,
      })),
    [stamps]
  );

  const handleSaveDraft = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      const content: SigningEnvelopeContent = {
        ink: JSON.parse(JSON.stringify(ink)) as SigningEnvelopeContent["ink"],
        stamps: serializableStamps(),
      };
      const updated = await saveDraft(envelope.id, JSON.stringify(content));
      toast.success("Draft saved — resume anytime");
      if (updated) onEnvelopeChange?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save draft failed");
    } finally {
      setSaving(false);
    }
  }, [locked, ink, serializableStamps, saveDraft, envelope.id, onEnvelopeChange]);

  const handleFinish = useCallback(async () => {
    if (locked) return;
    // Client-side block with the predicate's reason (server re-gates at 422).
    if (!verdict.valid) {
      toast.error(verdict.reason ?? "Envelope is not ready to finish");
      return;
    }
    setFinishing(true);
    try {
      const updated = await finishEnvelope(envelope.id, {
        ink,
        stamps: serializableStamps(),
        pageSizes,
        actor,
      });
      toast.success("Envelope finished and locked");
      if (updated) onEnvelopeChange?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finish failed");
    } finally {
      setFinishing(false);
    }
  }, [locked, verdict, finishEnvelope, envelope.id, ink, serializableStamps, pageSizes, actor, onEnvelopeChange]);

  const handleClearPage = useCallback(
    (page: number) => {
      canvasHandles.current[page]?.clear();
      setInkPages((prev) => ({ ...prev, [page]: [] }));
    },
    []
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header: envelope + validity verdict (overflow-safe per QA §2). */}
      <div className="border-b border-border px-2 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold sm:text-xl" title={template.title}>
              {template.title}
            </h1>
            <p className="truncate text-xs text-muted-foreground" title={`Envelope ${envelope.envelope_key} — ${envelope.status}`}>
              Envelope {envelope.envelope_key} — {envelope.status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={verdict.valid ? "default" : "secondary"}>
              {verdict.valid ? "Ready to finish" : "Incomplete"}
            </Badge>
            <Badge variant="outline">{actor.role === "hr" ? "HR override" : "Hiree"}</Badge>
          </div>
        </div>
        {!verdict.valid && verdict.reason && (
          <p className="mt-1 truncate text-xs text-amber-600 dark:text-amber-400" title={verdict.reason}>
            Finish blocked: {verdict.reason}
          </p>
        )}
        {locked && (
          <p className="mt-1 text-xs text-muted-foreground">
            Locked — routes to filing. Drafts can no longer be saved.
          </p>
        )}
      </div>

      {/* Toolbar: touch targets ≥32px, stacks at 375px. */}
      <div className="flex flex-col gap-2 border-b border-border px-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          disabled={locked}
          className="min-h-8 w-full sm:w-auto"
        >
          Capture stamp
        </Button>
        {pendingStamp && (
          <>
            <Badge variant="default">Tap a page to place the stamp</Badge>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingStamp(null)}
              className="min-h-8 w-full sm:w-auto"
            >
              Confirm placement
            </Button>
          </>
        )}
        <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSaveDraft()}
            disabled={locked || saving || finishing}
            className="min-h-8 w-full sm:w-auto"
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button
            type="button"
            onClick={() => void handleFinish()}
            disabled={locked || saving || finishing}
            className="min-h-8 w-full sm:w-auto"
            title={verdict.valid ? "Lock envelope and route to filing" : (verdict.reason ?? "Incomplete")}
          >
            {finishing ? "Finishing…" : "Finish"}
          </Button>
        </div>
      </div>

      {/* Pages: scrollable, capped at tablet width, full-bleed at 375px. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4">
        <div ref={pagesRef} className="mx-auto w-full max-w-[820px] space-y-6">
          {locked && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              This envelope is finished and locked. Ink and stamps are read-only.
            </p>
          )}
          {locked && (
            <SigningFilingPanel
              envelope={envelope}
              templateTitle={template.title}
              userId={null}
              listId={null}
              getPageNodes={getPageNodes}
              onFiled={() => void handleFiled()}
            />
          )}
          {pages.map((page) => (
            <div key={page} className="space-y-2">
              <TemplatePageView
                template={template}
                page={page}
                strokes={inkPages[page] ?? []}
                stamps={stamps}
                placingStamp={pendingStamp !== null && !locked}
                selectedStampId={selectedStampId}
                disabled={locked}
                onStrokesChange={handleStrokesChange}
                onTapPlace={handleTapPlace}
                onStampMove={handleStampMove}
                onStampSelect={setSelectedStampId}
                onStampDelete={handleStampDelete}
                canvasRef={registerCanvas}
              />
              {!locked && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClearPage(page)}
                    className="min-h-8"
                    aria-label={`Clear ink on page ${page}`}
                  >
                    Clear page {page}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <SignatureStampPicker
        open={pickerOpen}
        capturing={false}
        onClose={() => setPickerOpen(false)}
        onCapture={handleCapture}
      />
    </div>
  );
}
