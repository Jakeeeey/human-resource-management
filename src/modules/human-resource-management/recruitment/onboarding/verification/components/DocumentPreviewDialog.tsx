"use client";

import { useEffect, useState } from "react";
import type { QueueDocument } from "../types/verification-queue.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Download,
  FileWarning,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface DocumentPreviewDialogProps {
  open: boolean;
  doc: QueueDocument | null;
  onClose: () => void;
}

type PreviewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; url: string; type: string };

function assetUrlFor(doc: QueueDocument): string {
  return `/api/hrm/employee-admin/employee-master-list/assets/${doc.fileId}?filename=${encodeURIComponent(doc.title)}`;
}

export function DocumentPreviewDialog({
  open,
  doc,
  onClose,
}: DocumentPreviewDialogProps) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const assetUrl = doc ? assetUrlFor(doc) : null;

  useEffect(() => {
    if (!open || !assetUrl) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    fetch(assetUrl, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Preview failed");
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setState({ status: "ready", url: createdUrl, type: blob.type.toLowerCase() });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, assetUrl, reloadKey]);

  const handleRetry = () => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[720px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="truncate" title={doc?.title ?? "Document preview"}>
            {doc?.title ?? "Document preview"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <div className="rounded-xl border bg-muted/20 overflow-hidden">
            {state.status === "loading" ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-2">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                <span className="text-xs font-semibold text-muted-foreground animate-pulse">
                  Loading preview…
                </span>
              </div>
            ) : state.status === "error" ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
                <AlertCircle className="h-8 w-8 text-rose-500" />
                <p className="text-xs font-bold text-rose-700">
                  Could not load preview
                </p>
                <Button
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={handleRetry}
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : state.type.startsWith("image/") ? (
              <div className="flex items-center justify-center bg-zinc-950/5 p-4 max-h-[60vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.url}
                  alt={doc?.title ?? "Document preview"}
                  className="max-w-full max-h-[56vh] object-contain rounded-lg shadow-sm"
                />
              </div>
            ) : state.type === "application/pdf" ? (
              <div className="h-[60vh] bg-zinc-100">
                <iframe
                  src={state.url}
                  title={doc?.title ?? "Document preview"}
                  className="w-full h-full border-0"
                />
              </div>
            ) : (
              <PreviewUnavailable />
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2 bg-background">
          {assetUrl && (
            <Button asChild variant="outline" className="h-9 text-xs font-bold rounded-xl">
              <a href={assetUrl} download>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          )}
          <Button
            variant="secondary"
            className="px-5 font-bold h-9 text-xs rounded-xl"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
      <div className="p-3 rounded-full bg-amber-500/10">
        <FileWarning className="h-6 w-6 text-amber-600" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">No preview available</p>
        <p className="text-xs text-muted-foreground/70 max-w-sm">
          This file type cannot be previewed in the browser. Use the download
          button to access it.
        </p>
      </div>
    </div>
  );
}
