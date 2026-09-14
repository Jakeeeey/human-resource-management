"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActiveFilter,
  StatusFilter,
} from "@/modules/human-resource-management/onboarding/requirements/hooks/useTableControls";

// TrainingItemsTableFilters.tsx — the items drawer's filter row: text search
// plus the required/active status selects and the conditional Clear button. It
// mirrors the requirements module's toolbar but deliberately has NO facet prop:
// training items are scoped to one template, so a facet control would be a
// no-op. (The shared RequirementsTableFilters requires facet props.)

interface TrainingItemsTableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  required: StatusFilter;
  onRequiredChange: (value: StatusFilter) => void;
  active: ActiveFilter;
  onActiveChange: (value: ActiveFilter) => void;
  showClear: boolean;
  onClear: () => void;
}

/**
 * Renders the items drawer's search + required/active status filter row.
 * @param props Control values and change handlers.
 * @returns The responsive filter toolbar.
 */
export function TrainingItemsTableFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  required,
  onRequiredChange,
  active,
  onActiveChange,
  showClear,
  onClear,
}: TrainingItemsTableFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          className="pl-8"
        />
      </div>

      <Select
        value={required}
        onValueChange={(value) => onRequiredChange(value as StatusFilter)}
      >
        <SelectTrigger
          size="sm"
          className="w-full sm:w-[150px]"
          aria-label="Filter by required status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All required</SelectItem>
          <SelectItem value="required">Required</SelectItem>
          <SelectItem value="optional">Optional</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={active}
        onValueChange={(value) => onActiveChange(value as ActiveFilter)}
      >
        <SelectTrigger
          size="sm"
          className="w-full sm:w-[150px]"
          aria-label="Filter by active status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {showClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="w-full sm:w-auto"
        >
          <X className="mr-1 h-4 w-4" aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
