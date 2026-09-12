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

import {
  ALL_FACET,
  type ActiveFilter,
  type StatusFilter,
} from "../hooks/useTableControls";

// RequirementsTableFilters.tsx — the per-tab filter toolbar rendered between a
// section heading and its table. One text search plus optional role facet and
// the shared required/active status selects; every control narrows the same
// `useTableControls` result set. `Clear filters` appears only when a filter is
// active and resets them (sorting has its own header cycle).

/** One role facet: label + the catalog's own enum options. */
export interface FacetConfig {
  label: string;
  options: readonly { value: string; label: string }[];
}

interface RequirementsTableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Human label for the search box's accessible name. */
  searchLabel: string;
  facet?: FacetConfig;
  facetValue: string;
  onFacetChange: (value: string) => void;
  required: StatusFilter;
  onRequiredChange: (value: StatusFilter) => void;
  active: ActiveFilter;
  onActiveChange: (value: ActiveFilter) => void;
  showClear: boolean;
  onClear: () => void;
}

/**
 * Renders the search + facet + status filter toolbar for one catalog table.
 * @param props Control values, change handlers, and optional facet config.
 * @returns The responsive filter toolbar.
 */
export function RequirementsTableFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  facet,
  facetValue,
  onFacetChange,
  required,
  onRequiredChange,
  active,
  onActiveChange,
  showClear,
  onClear,
}: RequirementsTableFiltersProps) {
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

      {facet !== undefined && (
        <Select value={facetValue} onValueChange={onFacetChange}>
          <SelectTrigger
            size="sm"
            className="w-full sm:w-[160px]"
            aria-label={`Filter by ${facet.label.toLowerCase()}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FACET}>All</SelectItem>
            {facet.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
