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
import { Input } from "@/components/ui/input";
import { Pencil, Tag, Trash2 } from "lucide-react";

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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
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
    setRenamingId((cur) => (cur === id ? null : cur));
  };

  const beginRename = (id: string) => {
    const zone = zones.find((z) => z.id === id);
    setRenamingId(id);
    setRenameDraft(zone?.label ?? "");
  };

  const commitRename = () => {
    if (!renamingId) return;
    const label = renameDraft.trim().slice(0, 64);
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== renamingId) return z;
        if (!label) {
          const cleared: PaperworkZone = { ...z };
          delete cleared.label;
          return cleared;
        }
        return { ...z, label };
      })
    );
    setRenamingId(null);
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
            Page {activePage} of {numPages}
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
              onMouseEnter={() => setHoveredId(zone.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === zone.id ? null : cur))}
              onFocus={() => setHoveredId(zone.id)}
              onBlur={() => setHoveredId((cur) => (cur === zone.id ? null : cur))}
              className={`absolute rounded-sm border-2 ${
                selectedId === zone.id
                  ? "border-primary bg-primary/20"
                  : zone.required
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-yellow-300 bg-yellow-300/10"
              }`}
              style={{
                left: `${zone.rect.x * 100}%`,
                top: `${zone.rect.y * 100}%`,
                width: `${zone.rect.w * 100}%`,
                height: `${zone.rect.h * 100}%`,
              }}
            />
          ))}
          {pageZones
            .filter((zone) => zone.id === hoveredId && zone.id !== selectedId)
            .map((zone) => {
              const display = zone.label?.trim() ? zone.label : zone.id;
              const below = zone.rect.y < 0.25;
              return (
              <div
                key={`hover-${zone.id}`}
                className="pointer-events-none absolute z-10 max-w-[220px]"
                style={below
                  ? {
                      left: `${zone.rect.x * 100}%`,
                      top: `calc(${(zone.rect.y + zone.rect.h) * 100}% + 4px)`,
                    }
                  : {
                      left: `${zone.rect.x * 100}%`,
                      bottom: `calc(${(1 - zone.rect.y) * 100}% + 4px)`,
                    }
                }
              >
                <p
                  className="flex min-w-0 items-center gap-1.5 truncate rounded-full border border-border bg-card py-1 pl-2 pr-2.5 text-xs font-medium shadow-md"
                  title={display}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${zone.required ? "bg-orange-500" : "bg-yellow-300"}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{display}</span>
                </p>
              </div>
              );
            })}
          {pageZones
            .filter((zone) => zone.id === selectedId)
            .map((zone) => {
              // Flip above the rect when it sits near the page bottom so the
              // toolbar never clips below the surface.
              const flipUp = zone.rect.y + zone.rect.h > 0.8;
              return (
              <div
                key={`actions-${zone.id}`}
                className="absolute z-10 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-md"
                style={flipUp
                  ? {
                      left: `${zone.rect.x * 100}%`,
                      bottom: `calc(${(1 - zone.rect.y) * 100}% + 4px)`,
                    }
                  : {
                      left: `${zone.rect.x * 100}%`,
                      top: `calc(${(zone.rect.y + zone.rect.h) * 100}% + 4px)`,
                    }
                }
                onPointerDown={(e) => e.stopPropagation()}
              >
                {renamingId === zone.id ? (
                  <div className="flex min-w-0 items-center gap-1">
                    <Input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      placeholder="Zone label…"
                      maxLength={64}
                      autoFocus
                      className="h-8 w-40"
                      aria-label="Zone label"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={commitRename}
                      className="min-h-8 shrink-0"
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => beginRename(zone.id)}
                      className="min-h-8 min-w-8 px-2"
                      aria-label={`Rename ${zone.id}`}
                      title="Rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRequired(zone.id)}
                      className={`min-h-8 min-w-8 px-2 ${zone.required ? "bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400" : "text-muted-foreground"}`}
                      aria-label={zone.required ? "Make optional" : "Make required"}
                      aria-pressed={zone.required}
                      title={zone.required ? "Required — click to make optional" : "Optional — click to make required"}
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeZone(zone.id)}
                      className="min-h-8 min-w-8 px-2"
                      aria-label={`Delete ${zone.id}`}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
              );
            })}
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
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Click and drag on the rendered template to mark a zone.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" />
            Required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-yellow-300" aria-hidden="true" />
            Optional
          </span>
        </p>
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
