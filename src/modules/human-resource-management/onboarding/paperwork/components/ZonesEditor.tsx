"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PaperworkTemplate,
  PaperworkZone,
  PaperworkZoneRect,
} from "../types/paperwork-template.schema";
import {
  closePdfDocument,
  loadPdfDocument,
  type SigningPdfDocument,
} from "../../signing/components/pdfDocument";
import { PdfPageCanvas } from "../../signing/components/PdfPageCanvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

// ZonesEditor.tsx — admin marks signature zones via click-drag on the
// rendered template PDF (PDF-only: pages come from the pdf.js document, never
// HTML). Zones persist as template FRACTIONS (0..1, resolution-independent)
// with a per-page number; the signing surface maps ink points into the same
// fraction space before calling the single `isPaperworkValid` predicate.

const MIN_DRAG = 0.015;

interface DragAnchor {
  x: number;
  y: number;
}

interface ZonesEditorProps {
  open: boolean;
  template: PaperworkTemplate | null;
  saving: boolean;
  onClose: () => void;
  onSave: (template: PaperworkTemplate, zones: PaperworkZone[]) => void;
}

function normalizeRect(a: DragAnchor, b: DragAnchor): PaperworkZoneRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    w: Math.max(0, Math.min(1, Math.abs(b.x - a.x))),
    h: Math.max(0, Math.min(1, Math.abs(b.y - a.y))),
  };
}

function ZonesEditorBody({
  template,
  saving,
  onClose,
  onSave,
}: Omit<ZonesEditorProps, "open">) {
  const seed = template?.zones ?? [];
  const templateId = template?.id ?? null;
  const [zones, setZones] = useState<PaperworkZone[]>(seed);
  const [activePage, setActivePage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<DragAnchor | null>(null);
  const [draft, setDraft] = useState<PaperworkZoneRect | null>(null);
  const [doc, setDoc] = useState<SigningPdfDocument | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [docError, setDocError] = useState<string | null>(null);
  const [aspect, setAspect] = useState("3 / 4");
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Template PDF document: same proxy + loader the signing surface uses.
  // Page count comes from the document itself (no manual pager). The body
  // remounts per template (parent `key`), so fresh initial state on template
  // switch comes from the mount itself — no synchronous resets here.
  useEffect(() => {
    if (templateId === null) return;
    let dropped = false;
    let live: SigningPdfDocument | null = null;
    void loadPdfDocument(
      `/api/hrm/onboarding/paperwork-templates/${templateId}/pdf`
    )
      .then((loaded) => {
        if (dropped) {
          void loaded.close();
          return;
        }
        live = loaded;
        setNumPages(loaded.numPages);
        setDoc(loaded);
      })
      .catch((err: unknown) => {
        if (!dropped) {
          setDocError(
            err instanceof Error ? err.message : "Template PDF could not be loaded"
          );
        }
      });
    return () => {
      dropped = true;
      closePdfDocument(live);
    };
  }, [templateId]);

  const pageZones = useMemo(
    () => zones.filter((z) => z.page === activePage),
    [zones, activePage]
  );

  const toFraction = (clientX: number, clientY: number): DragAnchor | null => {
    const el = surfaceRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (clientY - box.top) / box.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const zoneEl = (e.target as HTMLElement).closest("[data-zone-id]");
    if (zoneEl) {
      setSelectedId(zoneEl.getAttribute("data-zone-id"));
      return;
    }
    const point = toFraction(e.clientX, e.clientY);
    if (!point) return;
    setAnchor(point);
    setDraft({ ...point, w: 0, h: 0 });
    setSelectedId(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!anchor) return;
    const point = toFraction(e.clientX, e.clientY);
    if (!point) return;
    setDraft(normalizeRect(anchor, point));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!anchor || !draft) {
      setAnchor(null);
      return;
    }
    if (draft.w >= MIN_DRAG && draft.h >= MIN_DRAG) {
      const id = `zone-${Date.now().toString(36)}-${zones.length + 1}`;
      setZones((prev) => [
        ...prev,
        { id, page: activePage, rect: draft, required: true },
      ]);
      setSelectedId(id);
    }
    setAnchor(null);
    setDraft(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const toggleRequired = (id: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, required: !z.required } : z))
    );
  };

  const removeZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const handleSave = () => {
    if (template) onSave(template, zones);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={page === activePage ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePage(page)}
              className="min-h-8 min-w-8"
            >
              {page}
            </Button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {pageZones.length} zone{pageZones.length === 1 ? "" : "s"} on page{" "}
            {activePage}
          </span>
        </div>

        <div
          ref={surfaceRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative min-h-64 cursor-crosshair touch-none overflow-hidden rounded-lg border border-border bg-card"
          style={{ aspectRatio: aspect }}
          aria-label={`Mark zones on page ${activePage}: click and drag`}
        >
          <PdfPageCanvas
            doc={doc}
            docError={docError}
            page={activePage}
            beyondEnd={activePage > numPages}
            targetWidth={800}
            onNaturalSize={(_page, size) =>
              setAspect(`${size.width} / ${size.height}`)
            }
          />
          {pageZones.map((zone) => (
            <div
              key={zone.id}
              data-zone-id={zone.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setSelectedId(zone.id)}
              className={`absolute rounded-sm border-2 ${
                selectedId === zone.id
                  ? "border-primary bg-primary/20"
                  : zone.required
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-emerald-500 bg-emerald-500/10"
              }`}
              style={{
                left: `${zone.rect.x * 100}%`,
                top: `${zone.rect.y * 100}%`,
                width: `${zone.rect.w * 100}%`,
                height: `${zone.rect.h * 100}%`,
              }}
              title={`${zone.id} — ${zone.required ? "required" : "optional"}`}
            />
          ))}
          {draft && draft.w > 0 && draft.h > 0 && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-primary bg-primary/10"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.w * 100}%`,
                height: `${draft.h * 100}%`,
              }}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Click and drag on the rendered template to mark a zone. Amber =
          required, green = optional. Tiny drags under the minimum size are
          ignored.
        </p>

        {zones.length > 0 && (
          <div className="space-y-2">
            <Label id="pw-zones-list">Zones ({zones.length})</Label>
            <ul className="max-h-48 space-y-2 overflow-y-auto" aria-labelledby="pw-zones-list">
              {zones.map((zone) => (
                <li
                  key={zone.id}
                  className={`flex min-h-8 items-center gap-2 rounded-lg border border-border px-2 py-1 text-sm ${
                    selectedId === zone.id ? "bg-muted" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(zone.id);
                      setActivePage(zone.page);
                    }}
                    className="min-h-8 min-w-0 flex-1 truncate text-left"
                    title={zone.id}
                  >
                    <span className="truncate font-mono text-xs">{zone.id}</span>
                  </button>
                  <Badge variant="outline">p{zone.page}</Badge>
                  <Badge variant={zone.required ? "default" : "secondary"}>
                    {zone.required ? "required" : "optional"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRequired(zone.id)}
                    className="min-h-8"
                  >
                    {zone.required ? "Make optional" : "Make required"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeZone(zone.id)}
                    className="min-h-8 min-w-8 px-2"
                    aria-label={`Delete ${zone.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : `Save ${zones.length} zone${zones.length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ZonesEditor({
  open,
  template,
  saving,
  onClose,
  onSave,
}: ZonesEditorProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {template ? `Mark zones — ${template.title}` : "Mark zones"}
          </DialogTitle>
        </DialogHeader>
        {open && template && (
          <ZonesEditorBody
            key={`${template.id}-${template.zones.length}`}
            template={template}
            saving={saving}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
