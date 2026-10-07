"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { PaperworkTemplate } from "../../paperwork/types/paperwork-template.schema";
import {
  isPaperworkValid,
  type PaperworkValidityVerdict,
} from "../../paperwork/paperworkValidity";
import type { PaperworkItem } from "../types/contracts";
import { humanizeValidityReason } from "../signingCopy";
import type { InkCanvasHandle } from "../InkCanvas";
import { parseInk, type SigningInk, type SigningStroke } from "../signingStrokes";
import { mergeStampsIntoInk } from "../signingStamps";
import type { PdfNaturalSize, SigningPdfDocument } from "./pdfDocument";
import type { CapturedStamp } from "./SignatureStampPicker";
import type { SignItemResult } from "../providers/signingEnvelopeProvider";
import { useSigningItemPdf } from "./useSigningItemPdf";
import { useSigningItemSign } from "./useSigningItemSign";

// useSigningItemModel.ts — the state model for ONE paperwork_item, composing
// the PDF lifecycle hook and the sign hook with ink/stamp state and the
// validity verdict. The view (SigningItemView) renders this model; no fetch
// or evidence logic lives in JSX.

export interface PlacedStamp {
  id: string;
  page: number;
  x: number;
  y: number;
  strokes: SigningStroke[];
  pngUrl?: string;
}

interface SigningItemModelInput {
  applicantId: number;
  item: PaperworkItem;
  template: PaperworkTemplate | null;
  awaitingOffer: boolean;
  onReconcile: () => Promise<void>;
  onSigned: (result: SignItemResult) => void;
}

export interface SigningItemModel {
  locked: boolean;
  requiredZoneCount: number;
  verdict: PaperworkValidityVerdict;
  validityMessage: string;
  pdfDoc: SigningPdfDocument | null;
  pdfPages: number | null;
  pdfError: string | null;
  pages: number[];
  inkPages: Record<number, SigningStroke[]>;
  pageSizes: Record<number, { width: number; height: number }>;
  stamps: PlacedStamp[];
  pendingStamp: CapturedStamp | null;
  selectedStampId: string | null;
  pickerOpen: boolean;
  signing: boolean;
  placingStamp: boolean;
  setPickerOpen: (open: boolean) => void;
  setPendingStamp: (stamp: CapturedStamp | null) => void;
  setSelectedStampId: (id: string | null) => void;
  registerCanvas: (page: number, handle: InkCanvasHandle | null) => void;
  handleStrokesChange: (page: number, strokes: SigningStroke[]) => void;
  handlePdfNaturalSize: (page: number, size: PdfNaturalSize) => void;
  handleTapPlace: (page: number, x: number, y: number) => void;
  handleStampMove: (id: string, x: number, y: number) => void;
  handleStampDelete: (id: string) => void;
  handleCapture: (captured: CapturedStamp) => void;
  handleClearPage: (page: number) => void;
  handleSign: () => Promise<void>;
}

function parseInkSafe(raw: string | null): SigningInk | null {
  if (!raw || raw.trim() === "") return null;
  try {
    return parseInk(raw);
  } catch {
    return null;
  }
}

export function useSigningItemModel({
  applicantId,
  item,
  template,
  awaitingOffer,
  onReconcile,
  onSigned,
}: SigningItemModelInput): SigningItemModel {
  const pdf = useSigningItemPdf(template);
  const [inkPages, setInkPages] = useState<Record<number, SigningStroke[]>>(
    () => {
      const seed: Record<number, SigningStroke[]> = {};
      const content = parseInkSafe(item.strokes);
      for (const page of content?.pages ?? []) {
        seed[page.page] = Array.isArray(page.strokes) ? page.strokes : [];
      }
      return seed;
    }
  );
  const [stamps, setStamps] = useState<PlacedStamp[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStamp, setPendingStamp] = useState<CapturedStamp | null>(null);
  const [selectedStampId, setSelectedStampId] = useState<string | null>(null);
  const canvasHandles = useRef<Record<number, InkCanvasHandle | null>>({});

  const locked = item.status === "signed";
  const requiredZoneCount = (template?.zones ?? []).filter(
    (zone) => zone.required
  ).length;

  const ink: SigningInk = useMemo(
    () => ({
      pages: pdf.pages.map((page) => ({
        page,
        strokes: inkPages[page] ?? [],
      })),
    }),
    [pdf.pages, inkPages]
  );

  const merged = useMemo(
    () => mergeStampsIntoInk(ink, stamps, pdf.pageSizes),
    [ink, stamps, pdf.pageSizes]
  );
  const verdict = useMemo(
    () => isPaperworkValid(template?.zones ?? [], merged, pdf.pageSizes),
    [template, merged, pdf.pageSizes]
  );
  const validityMessage = useMemo(
    () => humanizeValidityReason(template?.zones ?? [], verdict),
    [template, verdict]
  );

  const registerCanvas = useCallback(
    (page: number, handle: InkCanvasHandle | null) => {
      canvasHandles.current[page] = handle;
    },
    []
  );

  const handleStrokesChange = useCallback(
    (page: number, strokes: SigningStroke[]) => {
      setInkPages((prev) => ({ ...prev, [page]: strokes }));
    },
    []
  );

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
    setStamps((prev) =>
      prev.map((stamp) => (stamp.id === id ? { ...stamp, x, y } : stamp))
    );
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

  const handleClearPage = useCallback((page: number) => {
    canvasHandles.current[page]?.clear();
    setInkPages((prev) => ({ ...prev, [page]: [] }));
  }, []);

  const sign = useSigningItemSign({
    applicantId,
    itemId: item.id,
    template,
    locked,
    awaitingOffer,
    verdictValid: verdict.valid,
    validityMessage,
    pdfDoc: pdf.pdfDoc,
    pages: pdf.pages,
    mergedInk: merged,
    onReconcile,
    onSigned,
  });

  return {
    locked,
    requiredZoneCount,
    verdict,
    validityMessage,
    pdfDoc: pdf.pdfDoc,
    pdfPages: pdf.pdfPages,
    pdfError: pdf.pdfError,
    pages: pdf.pages,
    inkPages,
    pageSizes: pdf.pageSizes,
    stamps,
    pendingStamp,
    selectedStampId,
    pickerOpen,
    signing: sign.signing,
    placingStamp: pendingStamp !== null && !locked,
    setPickerOpen,
    setPendingStamp,
    setSelectedStampId,
    registerCanvas,
    handleStrokesChange,
    handlePdfNaturalSize: pdf.handlePdfNaturalSize,
    handleTapPlace,
    handleStampMove,
    handleStampDelete,
    handleCapture,
    handleClearPage,
    handleSign: sign.handleSign,
  };
}
