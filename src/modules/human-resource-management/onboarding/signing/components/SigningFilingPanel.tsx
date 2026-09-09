"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SigningEnvelope } from "../types/signing-envelope.schema";
import {
  capturePagesToPng,
  flattenPagesToPdf,
} from "../signingFlatten";
import { fileFinishedEnvelope } from "../signingFiling";
import type { VaultPointer } from "../signingVault";

// SigningFilingPanel.tsx — Todo 8 filing surface (client). Renders inside
// the signing surface for LOCKED envelopes: captures the same-origin page
// boxes via the REAL `html-to-image.toPng` call, slices A4 PDF bytes with a
// selectable text layer, then files upload → `data.id` → link. Vault goes
// pointer-only after confirm; oversize rejects 413 (never downscaled).

interface SigningFilingPanelProps {
  envelope: SigningEnvelope;
  templateTitle: string;
  /** 201 owner (hire employee id). Null until Todo 9/10 supplies it. */
  userId: number | null;
  /** 201 record list id. Null until Todo 9/10 supplies it. */
  listId: number | null;
  /** Returns the rendered same-origin page boxes in page order. */
  getPageNodes: () => HTMLElement[];
  onFiled?: (pointer: VaultPointer) => void;
}

export function SigningFilingPanel({
  envelope,
  templateTitle,
  userId,
  listId,
  getPageNodes,
  onFiled,
}: SigningFilingPanelProps) {
  const [filing, setFiling] = useState(false);
  const [reason, setReason] = useState("");
  const [pointer, setPointer] = useState<VaultPointer | null>(null);

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
      // Client-side flatten: REAL toPng per page → jspdf A4 slices.
      const nodes = getPageNodes();
      const shots = await capturePagesToPng(nodes);
      const { bytes } = await flattenPagesToPdf(
        shots.map((pngDataUrl, index) => ({
          page: index + 1,
          pngDataUrl,
          textLines: [
            { text: templateTitle },
            { text: `Envelope ${envelope.envelope_key} — page ${index + 1}` },
          ],
        }))
      );
      const result = await fileFinishedEnvelope({
        envelopeId: envelope.id,
        envelopeKey: envelope.envelope_key,
        pdfBytes: bytes,
        record: {
          user_id: userId as number,
          list_id: listId as number,
          record_name: `Signed ${templateTitle} (${envelope.envelope_key})`,
          description: `Flattened signing envelope ${envelope.envelope_key}`,
        },
        reason: alreadyFiled ? reason.trim() : undefined,
        version: alreadyFiled ? 2 : 1,
      });
      setPointer(result.pointer);
      toast.success(
        result.pointer.version > 1
          ? `Re-filed as vault version ${result.pointer.version}`
          : "Filed to 201"
      );
      onFiled?.(result.pointer);
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
    getPageNodes,
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
