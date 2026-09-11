"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PenLine } from "lucide-react";
import { isCompletionPending } from "../../signing/signingCopy";
import type {
  JobOffer,
  Paperworks,
  SigningEnvelope,
} from "../../signing/types/contracts";

// SigningDeskQueueCards.tsx — the <lg queue: a stacked card per signing set
// so the primary action (Open signing set / Review) is reachable on narrow
// viewports instead of sitting behind the table's horizontal scroll.

export interface SigningQueueRow {
  applicant: {
    id: number;
    full_name: string;
    position_applied_for: string | null;
    status: string | null;
  };
  envelope: SigningEnvelope;
  offer: JobOffer | null;
  paperworks: Paperworks | null;
}

interface SigningDeskQueueCardsProps {
  rows: SigningQueueRow[];
  isLoading: boolean;
  launchingId: number | null;
  onOpen: (row: SigningQueueRow) => void;
}

export function SigningDeskQueueCards({
  rows,
  isLoading,
  launchingId,
  onOpen,
}: SigningDeskQueueCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-3 lg:hidden">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="p-3 text-center text-sm text-muted-foreground lg:hidden">
        No applicants have a signing set yet.
      </p>
    );
  }
  return (
    <div className="space-y-3 p-3 lg:hidden">
      {rows.map((row) => {
        const hirePending = isCompletionPending(
          row.envelope.status,
          row.applicant.status
        );
        return (
          <div
            key={row.envelope.id}
            className="space-y-2 rounded-xl border border-border/60 bg-card p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className="min-w-0 truncate text-sm font-semibold"
                title={row.applicant.full_name}
              >
                {row.applicant.full_name}
              </p>
              <Badge variant="outline" className="shrink-0">
                {row.applicant.status ?? "—"}
              </Badge>
            </div>
            {row.applicant.position_applied_for && (
              <p
                className="truncate text-xs text-muted-foreground"
                title={row.applicant.position_applied_for}
              >
                {row.applicant.position_applied_for}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                Offer: {row.offer?.status ?? "—"}
              </Badge>
              <Badge variant="secondary">
                Paperworks:{" "}
                {row.paperworks
                  ? `${row.paperworks.signed_count}/${row.paperworks.required_count}`
                  : "—"}
              </Badge>
              <Badge
                variant={
                  hirePending
                    ? "outline"
                    : row.envelope.status === "complete"
                      ? "default"
                      : "secondary"
                }
                className={
                  hirePending
                    ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : undefined
                }
              >
                {hirePending ? "complete — hire pending" : row.envelope.status}
              </Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={launchingId !== null}
              onClick={() => onOpen(row)}
              aria-label={`Open signing set for ${row.applicant.full_name}`}
              title={
                hirePending
                  ? "Review — completion needs attention"
                  : row.envelope.status === "complete"
                    ? "Review the completed signing set"
                    : "Open the signing set"
              }
              className="min-h-8 w-full"
            >
              <PenLine className="mr-2 h-4 w-4" />
              {launchingId === row.envelope.id
                ? "Opening…"
                : row.envelope.status === "complete"
                  ? "Review"
                  : "Open signing set"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
