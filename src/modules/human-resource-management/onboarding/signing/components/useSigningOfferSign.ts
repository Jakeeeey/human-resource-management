"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { serializeInk, type SigningInk } from "../signingStrokes";
import { renderSignedItemPdf } from "../signingItemPdf";
import { buildFilingFilename } from "../signingVault";
import { uploadFiledPdf } from "../signingFiling";
import type { SigningPdfDocument } from "./pdfDocument";
import { SIGNING_PAGE_W } from "./TemplatePageView";
import {
  useSigningEnvelopeFetch,
  type SignJobOfferPayload,
  type SignOfferResult,
} from "../providers/signingEnvelopeProvider";

// useSigningOfferSign.ts — the sign+file commit pipeline for the job offer:
// composite the offer PDF raster + ink to PDF bytes, upload through the
// existing employee-file route, PATCH the offer (which sets status="signed"
// and recomputes the rollups), and report the completion outcome. A failure
// replays the SAME payload — the offer write is idempotent for an identical
// (signature_file, signed_pdf_file) pair — so a response lost after the
// server write still reconciles into full surface state.

interface SigningOfferSignInput {
  applicantId: number | null;
  offerId: number | null;
  locked: boolean;
  verdictValid: boolean;
  validityMessage: string;
  pdfDoc: SigningPdfDocument | null;
  pages: number[];
  mergedInk: SigningInk;
  onSigned: (result: SignOfferResult) => void;
}

export interface SigningOfferSignModel {
  signing: boolean;
  handleSign: () => Promise<void>;
}

export function useSigningOfferSign({
  applicantId,
  offerId,
  locked,
  verdictValid,
  validityMessage,
  pdfDoc,
  pages,
  mergedInk,
  onSigned,
}: SigningOfferSignInput): SigningOfferSignModel {
  const { signJobOffer } = useSigningEnvelopeFetch();
  const [signing, setSigning] = useState(false);

  const handleSign = useCallback(async () => {
    if (applicantId === null || offerId === null || locked || signing) return;
    if (!verdictValid) {
      toast.error(validityMessage);
      return;
    }
    if (pdfDoc === null) {
      toast.error("Wait for the offer PDF to finish loading");
      return;
    }
    setSigning(true);
    let payload: SignJobOfferPayload | null = null;
    try {
      const bytes = await renderSignedItemPdf({
        doc: pdfDoc,
        pages,
        targetWidth: SIGNING_PAGE_W,
        ink: mergedInk,
      });
      const filename = buildFilingFilename(
        `applicant-${applicantId}-offer`,
        1
      );
      const fileId = await uploadFiledPdf(bytes, filename);
      payload = { strokes: serializeInk(mergedInk), signed_pdf_file: fileId };
      const result = await signJobOffer(offerId, payload);
      onSigned(result);
      if (
        result.completion.kind === "blocked" ||
        result.completion.kind === "failed"
      ) {
        toast.warning("Job offer signed — completion needs attention");
      } else {
        toast.success("Job offer signed and filed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signing failed");
      if (payload !== null) {
        try {
          const reconciled = await signJobOffer(offerId, payload);
          onSigned(reconciled);
          toast.success("Job offer signed and filed");
        } catch {
          // Reconcile is best-effort — the mutation error was already toasted.
        }
      }
    } finally {
      setSigning(false);
    }
  }, [
    applicantId,
    offerId,
    locked,
    signing,
    verdictValid,
    validityMessage,
    pdfDoc,
    pages,
    mergedInk,
    signJobOffer,
    onSigned,
  ]);

  return { signing, handleSign };
}
