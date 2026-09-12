"use client";

import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

// RequirementsSectionHeader.tsx — the heading row shared by the four catalog
// sections: title, live row-count text, description, and the Refresh/New
// actions. Extracted from RequirementsSection to keep that file within the
// module's size budget.

interface RequirementsSectionHeaderProps {
  title: string;
  description: string;
  /** `Showing N of M` while filtered, else `M rows`. */
  countLabel: string;
  /** Singular noun for the New button's accessible name, e.g. "document". */
  entityLabel: string;
  isLoading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

/**
 * Renders one section's title/count/description and Refresh + New actions.
 * @param props Section copy, count text, loading state, and action handlers.
 * @returns The header markup.
 */
export function RequirementsSectionHeader({
  title,
  description,
  countLabel,
  entityLabel,
  isLoading,
  onRefresh,
  onCreate,
}: RequirementsSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          <span className="text-sm text-muted-foreground">{countLabel}</span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={`Refresh ${title}`}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
        <Button
          onClick={onCreate}
          aria-label={`New ${entityLabel}`}
          className="w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          New
        </Button>
      </div>
    </div>
  );
}
