"use client";

import { useState } from "react";
import { Clock, TriangleAlert } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/ui/status-badge";

import type { RosterRow } from "../types/performance-evaluation.schema";
import { attentionFor, formatRosterDate } from "./EvaluationRosterTable";
import { EvaluationRosterDetail } from "./EvaluationRosterDetail";
import { StatusPill, statusToneBadgeClass } from "./StatusPill";

export function EvaluationRosterPanel({
  open,
  onOpenChange,
  row,
  workspaceHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: RosterRow | null;
  workspaceHref?: string;
}) {
  const [lastRow, setLastRow] = useState<RosterRow | null>(row);
  if (row !== null && row !== lastRow) {
    setLastRow(row);
  }
  const visible = row ?? lastRow;

  const meta =
    visible === null
      ? ""
      : [visible.department_name, visible.position]
          .filter(
            (part): part is string =>
              typeof part === "string" && part.trim() !== ""
          )
          .join(" · ");
  const attention = visible === null ? null : attentionFor(visible);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full min-w-0 flex-col gap-0 p-0 sm:max-w-md"
        aria-label={
          visible === null
            ? "Evaluation summary"
            : `Evaluation summary for ${visible.full_name}`
        }
        onEscapeKeyDown={() => onOpenChange(false)}
        onPointerDownOutside={() => onOpenChange(false)}
        onCloseAutoFocus={(event) => {
          const id = visible?.user_id;
          if (id === undefined) return;
          const twins = document.querySelectorAll(
            `[data-roster-row="${id}"]`
          );
          let target: Element | null = null;
          for (const twin of twins) {
            if (
              twin instanceof HTMLElement &&
              twin.getClientRects().length > 0
            ) {
              target = twin;
              break;
            }
          }
          target ??= twins[0] ?? null;
          if (target instanceof HTMLElement) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        {visible === null ? null : (
          <>
            <SheetHeader className="border-b border-border/50 p-4 pr-12 text-left">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill status={visible.probation_status} />
                {attention === "overdue" ? (
                  <StatusBadge
                    tone="destructive"
                    className={statusToneBadgeClass("destructive")}
                  >
                    <TriangleAlert aria-hidden="true" />
                    Overdue
                  </StatusBadge>
                ) : null}
                {attention === "soon" ? (
                  <StatusBadge
                    tone="warning"
                    className={statusToneBadgeClass("warning")}
                  >
                    <Clock aria-hidden="true" />
                    Due soon
                  </StatusBadge>
                ) : null}
              </div>
              <SheetTitle
                className="mt-2 truncate text-lg"
                title={visible.full_name}
              >
                {visible.full_name}
              </SheetTitle>
              <SheetDescription className="truncate">
                {meta === "" ? "—" : meta} · Hired{" "}
                {formatRosterDate(visible.date_hired)}
              </SheetDescription>
            </SheetHeader>

            <div className="min-w-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
              <EvaluationRosterDetail
                row={visible}
                workspaceHref={workspaceHref}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
