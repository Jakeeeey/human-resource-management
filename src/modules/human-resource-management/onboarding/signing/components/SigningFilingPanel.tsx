"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SigningEnvelope } from "../types/signing-envelope.schema";
import {
  requestPdfBurn,
  stampPreviewToDataUrl,
  type PdfBurnPointer,
} from "../pdfBurnClient";

// SigningFilingPanel.tsx — Todo 18 filing surface (client). Renders inside
// the signing surface for LOCKED envelopes: the server burns the LOCKED
// envelope strokes into the trusted admin-template PDF via `pdf-lib` and
// files upload → `data.id` → link. Vault goes pointer-only after confirm;
// oversize/corrupt rejects with reason (never filed, never downscaled).
// The Todo 8 `html-to-image`/`jspdf` client flatten branch is REMOVED from
// this path (those files stay for history — never imported here).

interface SigningFilingPanelProps {
  envelope: SigningEnvelope;
  templateTitle: string;
  /** 201 owner (hire employee id). Null until Todo 9/10 supplies it. */
  userId: number | null;
  /** 201 record list id. Null until Todo 9/10 supplies it. */
  listId: number | null;
  /** Renderer-owned bitmap size per 1-based page (fraction bridge). */
  pageSizes: Record<number, { width: number; height: number }>;
  /** Placed stamps (preview URLs feed the redundant PNG embed, best-effort). */
  stamps: { id: string; pngUrl?: string }[];
  onFiled?: (pointer: PdfBurnPointer) => void;
}

export function SigningFilingPanel({
  envelope,
  templateTitle,
  userId,
  listId,
  pageSizes,
  stamps,
  onFiled,
}: SigningFilingPanelProps) {
  const [filing, setFiling] = useState(false);
  const [reason, setReason] = useState("");
  const [pointer, setPointer] = useState<PdfBurnPointer | null>(null);

  const locked = envelope.status === "finished";
  const alreadyFiled = envelope.pdf_file !== null && envelope.pdf_file !== "";
  const configured = userId !== null && listId !== null;

  const handleFile = useCallback(async () => {
    if (!locked || filing) return;
    if (!configured) {
      toast.error("Filing is not configured for this hire yet (missing 201 owner)");
      return;
    }
    if (alreadyFiled && reason.trim() === "") {
      toast.error("Re-file needs a reason — filed PDFs overwrite only with a new vault version");
      return;
    }
    setFiling(true);
    try {
      // Server-side burn: the route reads the LOCKED strokes itself — the
      // client sends only the 201 intent + page sizes (+ redundant PNGs).
      const stampPngs: { stampId: string; pngDataUrl: string }[] = [];
      for (const stamp of stamps) {
        const pngDataUrl = await stampPreviewToDataUrl(stamp.pngUrl);
        if (pngDataUrl) stampPngs.push({ stampId: stamp.id, pngDataUrl });
      }
      const result = await requestPdfBurn({
        envelopeId: envelope.id,
        record: {
          user_id: userId as number,
          list_id: listId as number,
          record_name: `Signed ${templateTitle} (${envelope.envelope_key})`,
          description: `Burned signing envelope ${envelope.envelope_key}`,
        },
        pageSizes,
        reason: alreadyFiled ? reason.trim() : undefined,
        stampPngs,
      });
      setPointer(result);
      toast.success(
        result.version > 1
          ? `Re-filed as vault version ${result.version}`
          : "Filed to 201"
      );
      onFiled?.(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Filing failed");
    } finally {
      setFiling(false);
    }
  }, [
    locked,
    filing,
    configured,
    alreadyFiled,
    reason,
    pageSizes,
    stamps,
    templateTitle,
    envelope,
    userId,
    listId,
    onFiled,
  ]);

  if (!locked) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title="File the locked envelope to 201">
            {alreadyFiled ? "Filed — re-file creates a new vault version" : "Locked — ready to file"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {pointer
              ? `Pointer-only: ${pointer.fileId}`
              : "Vault stages the upload until the 201 link confirms"}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void handleFile()}
          disabled={filing || !configured}
          className="min-h-8 w-full sm:w-auto"
          title={
            !configured
              ? "Filing is not configured for this hire yet"
              : alreadyFiled
                ? "Re-file with a new vault version + reason"
                : "Flatten pages and file to 201"
          }
        >
          {filing ? "Filing…" : alreadyFiled ? "Re-file to 201" : "File to 201"}
        </Button>
      </div>
      {alreadyFiled && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Re-file reason (required)"
          aria-label="Re-file reason"
          className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
        />
      )}
      {!configured && (
        <p className="mt-1 text-xs text-muted-foreground">
          Filing unlocks when the hire&apos;s 201 owner and record list are linked.
        </p>
      )}
    </div>
  );
}
