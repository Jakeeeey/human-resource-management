"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closePdfDocument,
  loadPdfDocument,
  type PdfNaturalSize,
  type SigningPdfDocument,
} from "./pdfDocument";
import { SIGNING_PAGE_H, SIGNING_PAGE_W } from "./TemplatePageView";

// useSigningOfferPdf.ts — PDF document lifecycle + page bitmap sizing for the
// job offer: loads the HR-uploaded offer PDF through the asset proxy, tracks
// the natural size reported by every rendered page, and exposes the 1-based
// page list plus a complete pageSizes map (default size as the fallback) for
// ink/validity. Document state is keyed by source URL, so switching offers
// never shows the previous document's pages. The offer has no zones — every
// page is a full-page signing surface.

function offerPdfSource(pdfFile: string | null): {
  url: string | null;
  reason: string | null;
} {
  if (!pdfFile) {
    return {
      url: null,
      reason: "The offer document has not been uploaded yet",
    };
  }
  return {
    url: `/api/hrm/employee-admin/employee-master-list/assets/${pdfFile}?filename=${encodeURIComponent("Job Offer.pdf")}`,
    reason: null,
  };
}

interface LoadedPdf {
  url: string;
  doc: SigningPdfDocument;
  pages: number;
}

interface PdfFailure {
  url: string;
  reason: string;
}

interface SizedPages {
  url: string | null;
  sizes: Record<number, PdfNaturalSize>;
}

export interface SigningOfferPdfModel {
  pdfDoc: SigningPdfDocument | null;
  pdfPages: number | null;
  pdfError: string | null;
  pages: number[];
  pageSizes: Record<number, { width: number; height: number }>;
  handlePdfNaturalSize: (page: number, size: PdfNaturalSize) => void;
}

export function useSigningOfferPdf(
  pdfFile: string | null
): SigningOfferPdfModel {
  const pdfSource = useMemo(() => offerPdfSource(pdfFile), [pdfFile]);
  const url = pdfSource.url;
  const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
  const [failure, setFailure] = useState<PdfFailure | null>(null);
  const [sized, setSized] = useState<SizedPages>({ url: null, sizes: {} });

  useEffect(() => {
    let dropped = false;
    let doc: SigningPdfDocument | null = null;
    if (url === null) {
      return () => {
        dropped = !dropped;
      };
    }
    loadPdfDocument(url)
      .then((loadedDoc) => {
        if (dropped) {
          closePdfDocument(loadedDoc);
          return;
        }
        doc = loadedDoc;
        setLoaded({ url, doc: loadedDoc, pages: loadedDoc.numPages });
      })
      .catch((err: unknown) => {
        if (dropped) return;
        setFailure({
          url,
          reason:
            err instanceof Error ? err.message : "Offer PDF could not be loaded",
        });
      });
    return () => {
      dropped = !dropped;
      closePdfDocument(doc);
    };
  }, [url]);

  const active = loaded !== null && loaded.url === url ? loaded : null;
  const pdfDoc = active ? active.doc : null;
  const pdfPages = active ? active.pages : null;
  const pdfSizes = useMemo(
    () => (sized.url === url ? sized.sizes : {}),
    [sized, url]
  );
  const pdfError =
    url === null
      ? pdfSource.reason
      : failure !== null && failure.url === url
        ? failure.reason
        : null;

  const pageCount = pdfPages === null ? 1 : Math.max(1, pdfPages);
  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i + 1),
    [pageCount]
  );

  const pageSizes = useMemo(() => {
    const sizes: Record<number, { width: number; height: number }> = {};
    for (const page of pages) {
      const natural = pdfSizes[page];
      sizes[page] =
        natural !== undefined
          ? { width: natural.width, height: natural.height }
          : { width: SIGNING_PAGE_W, height: SIGNING_PAGE_H };
    }
    return sizes;
  }, [pages, pdfSizes]);

  const handlePdfNaturalSize = useCallback(
    (page: number, size: PdfNaturalSize) => {
      setSized((prev) => {
        const base = prev.url === url ? prev.sizes : {};
        if (base[page] !== undefined) return { url, sizes: base };
        return { url, sizes: { ...base, [page]: size } };
      });
    },
    [url]
  );

  return {
    pdfDoc,
    pdfPages,
    pdfError,
    pages,
    pageSizes,
    handlePdfNaturalSize,
  };
}
