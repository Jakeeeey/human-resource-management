"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import { serializeInk, type SigningInk } from "../signingStrokes";
import { renderSignedItemPdf } from "../signingItemPdf";
import { buildFilingFilename } from "../signingVault";
import { uploadFiledPdf } from "../signingFiling";
import type { SigningPdfDocument } from "./pdfDocument";
import { SIGNING_PAGE_W } from "./TemplatePageView";
import {
  useSigningEnvelopeFetch,
  type SignItemResult,
} from "../providers/signingEnvelopeProvider";

// useSigningItemSign.ts — the sign+file commit pipeline for one paperwork
// item: composite raster+ink to PDF bytes, upload through the existing
// employee-file route, PATCH the item, and report the completion outcome.
// A failure triggers a server reconcile (the item write may have landed).

interface SigningItemSignInput {
  applicantId: number;
  itemId: number;
  template: PaperworkTemplate | null;
  locked: boolean;
  awaitingOffer: boolean;
  verdictValid: boolean;
  validityMessage: string;
  pdfDoc: SigningPdfDocument | null;
  pages: number[];
  mergedInk: SigningInk;
  onReconcile: () => Promise<void>;
  onSigned: (result: SignItemResult) => void;
}

export interface SigningItemSignModel {
  signing: boolean;
  handleSign: () => Promise<void>;
}

export function useSigningItemSign({
  applicantId,
  itemId,
  template,
  locked,
  awaitingOffer,
  verdictValid,
  validityMessage,
  pdfDoc,
  pages,
  mergedInk,
  onReconcile,
  onSigned,
}: SigningItemSignInput): SigningItemSignModel {
  const { signPaperworkItem } = useSigningEnvelopeFetch();
  const [signing, setSigning] = useState(false);

  const handleSign = useCallback(async () => {
    if (locked || signing || awaitingOffer) return;
    if (!template) {
      toast.error("This template is no longer in the registry");
      return;
    }
    if (!verdictValid) {
      toast.error(validityMessage);
      return;
    }
    if (pdfDoc === null) {
      toast.error("Wait for the template PDF to finish loading");
      return;
    }
    setSigning(true);
    try {
      const bytes = await renderSignedItemPdf({
        doc: pdfDoc,
        pages,
        targetWidth: SIGNING_PAGE_W,
        ink: mergedInk,
      });
      const filename = buildFilingFilename(
        `applicant-${applicantId}-item-${itemId}`,
        1
      );
      const fileId = await uploadFiledPdf(bytes, filename);
      const result = await signPaperworkItem(
        itemId,
        serializeInk(mergedInk),
        fileId
      );
      onSigned(result);
      if (
        result.completion.kind === "blocked" ||
        result.completion.kind === "failed"
      ) {
        toast.warning(`${template.title} signed — completion needs attention`);
      } else {
        toast.success(`${template.title} signed and filed`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signing failed");
      await onReconcile();
    } finally {
      setSigning(false);
    }
  }, [
    locked,
    signing,
    awaitingOffer,
    template,
    verdictValid,
    validityMessage,
    pdfDoc,
    pages,
    mergedInk,
    applicantId,
    itemId,
    signPaperworkItem,
    onReconcile,
    onSigned,
  ]);

  return { signing, handleSign };
}
