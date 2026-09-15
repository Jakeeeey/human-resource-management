"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { phaseLabel } from "../rosterData";
import { HireRosterDetail } from "./HireRosterDetail";
import type { HireRosterRow } from "../types/hire-roster.schema";

// HireRosterPanel.tsx — the roster's single summary presentation: a controlled
// right-side shadcn Sheet (wide on desktop) that shows the selected hire's
// onboarding summary. It mirrors the training-templates `TemplateItemsDrawer`
// contract: fully controlled via `open`/`onOpenChange`, no internal open state,
// and no render at all when no hire is selected.

interface HireRosterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected hire; null renders nothing. */
  row: HireRosterRow | null;
  /** Passed through to the summary's workspace link. */
  workspaceHref?: string;
}

/**
 * Renders the selected hire's summary in a controlled right-side slide-over.
 * @param props Sheet open state, change handler, selected row, and workspace link.
 * @returns The panel, or nothing when no hire is selected.
 */
export function HireRosterPanel({
  open,
  onOpenChange,
  row,
  workspaceHref,
}: HireRosterPanelProps) {
  if (row === null) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full min-w-0 flex-col gap-0 p-0 sm:max-w-3xl"
        aria-label={`Onboarding summary for ${row.name}`}
      >
        <SheetHeader className="border-b border-border/50 p-4 pr-12">
          <SheetTitle className="truncate text-lg" title={row.name}>
            {row.name}
          </SheetTitle>
          <SheetDescription className="truncate">
            Employee #{row.userId} · {phaseLabel(row.phase)}
          </SheetDescription>
        </SheetHeader>

        <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4">
          <HireRosterDetail row={row} workspaceHref={workspaceHref} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
