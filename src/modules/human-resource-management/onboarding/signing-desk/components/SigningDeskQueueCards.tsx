"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PenLine } from "lucide-react";
import { isCompletionPending } from "../../signing/signingCopy";
import { paperworksBadge } from "./paperworksBadge";
import { signingDeskJobFields } from "./signingDeskFields";
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
        const paperworkBadge = paperworksBadge(row.paperworks);
        const fields = signingDeskJobFields(
          row.applicant.position_applied_for,
          row.offer
        );
        return (
          <div
            key={row.envelope.id}
            className="space-y-2 rounded-xl border border-border/60 bg-card p-3"
          >
            <p
              className="min-w-0 truncate text-sm font-semibold"
              title={row.applicant.full_name}
            >
              {row.applicant.full_name}
            </p>
            <dl className="space-y-0.5 text-xs text-muted-foreground">
              <div className="flex min-w-0 gap-1">
                <dt className="shrink-0">Department:</dt>
                <dd
                  className="min-w-0 truncate"
                  title={fields.department ?? "No department on record"}
                >
                  {fields.department ?? "—"}
                </dd>
              </div>
              <div className="flex min-w-0 gap-1">
                <dt className="shrink-0">Position:</dt>
                <dd
                  className="min-w-0 truncate"
                  title={fields.position ?? "No position on record"}
                >
                  {fields.position ?? "—"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={paperworkBadge.variant}
                className={paperworkBadge.className}
                title={paperworkBadge.label}
              >
                {paperworkBadge.label}
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
