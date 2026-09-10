"use client";

import { useMemo, useState } from "react";
import type { QueueRow } from "../types/verification-queue.schema";
import { buildDocRef } from "../types/acknowledgement-log.schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RefreshCw, Search, User } from "lucide-react";

// AcknowledgementTrailDialog.tsx — per-document who/when trail. Ports the
// memo-acknowledgement trail render pattern (port, never import): header strip
// (doc ref + count), loading skeleton, empty state, error + Retry (retry-read
// pattern), search filter, who/when rows (signer + method badge + timestamp).

interface AcknowledgementTrailDialogProps {
  open: boolean;
  row: QueueRow | null;
  docRef: string | null;
  logs: { signer: string; method: string; acknowledged_at: string; id: number | string }[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export function AcknowledgementTrailDialog({
  open,
  row,
  docRef,
  logs,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onClose,
}: AcknowledgementTrailDialogProps) {
  const [search, setSearch] = useState("");
  const ref = docRef ?? (row ? buildDocRef(row.userId) : "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return logs;
    return logs.filter((l) => l.signer.toLowerCase().includes(q));
  }, [logs, search]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="truncate" title={ref}>
            Acknowledgement trail
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-2 shrink-0">
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 border px-3 py-2 min-w-0">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                Document
              </span>
              <span className="text-[11px] font-bold truncate mt-0.5" title={ref}>
                {ref || "—"}
              </span>
            </div>
            <div className="w-px h-7 bg-border shrink-0" />
            <div className="flex flex-col shrink-0 items-end">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                Acks
              </span>
              <span className="text-[11px] font-bold mt-0.5">{logs.length}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <span className="text-xs font-semibold text-muted-foreground animate-pulse">
                Loading acknowledgement trail…
              </span>
              <Skeleton className="h-10 w-full mt-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 border border-rose-100 rounded-2xl bg-rose-50/10 space-y-3 text-center select-none">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-700">
                  Could not load trail
                </p>
                <p className="text-[10px] text-muted-foreground max-w-xs">
                  {errorMessage ?? "Fetch failed"}
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 text-xs font-bold gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                onClick={onRetry}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12 italic border border-dashed rounded-2xl bg-muted/20 select-none">
              No acknowledgements recorded for this document yet.
            </div>
          ) : (
            <div className="flex flex-col min-h-0 space-y-2">
              {logs.length > 1 && (
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search signer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-7 h-7 text-[11px]"
                  />
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                {filtered.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-12 italic select-none">
                    No matching signers found for &quot;{search}&quot;.
                  </div>
                ) : (
                  filtered.map((ack) => (
                    <div
                      key={String(ack.id)}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-card border text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                          <User className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className="text-[11px] font-bold truncate leading-tight"
                            title={ack.signer}
                          >
                            {ack.signer}
                          </p>
                          <p className="text-[9px] text-muted-foreground leading-tight">
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[9px] capitalize"
                              title={ack.method}
                            >
                              {ack.method}
                            </Badge>
                          </p>
                        </div>
                      </div>
                      <span
                        className="text-[9px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 ml-2 whitespace-nowrap"
                        title={ack.acknowledged_at}
                      >
                        {ack.acknowledged_at}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2 bg-background">
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
