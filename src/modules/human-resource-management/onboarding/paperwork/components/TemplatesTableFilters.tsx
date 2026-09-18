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

import type { TemplateStatusFilter } from "../hooks/useTemplateTableControls";

// TemplatesTableFilters.tsx — the filter toolbar rendered between the registry
// heading and its table. One text search (template title + company names) plus
// the active status select; every control narrows the same
// `useTemplateTableControls` result set. `Clear filters` appears only when a
// filter is active and resets them (sorting has its own header cycle). Mirrors
// the requirements module's `RequirementsTableFilters`.

interface TemplatesTableFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: TemplateStatusFilter;
  onStatusChange: (value: TemplateStatusFilter) => void;
  showClear: boolean;
  onClear: () => void;
}

/**
 * Renders the search + status filter toolbar for the template table.
 * @param props Control values and change handlers.
 * @returns The responsive filter toolbar.
 */
export function TemplatesTableFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  showClear,
  onClear,
}: TemplatesTableFiltersProps) {
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
          placeholder="Search by title or company…"
          aria-label="Search templates"
          className="pl-8"
        />
      </div>

      <Select
        value={status}
        onValueChange={(value) => onStatusChange(value as TemplateStatusFilter)}
      >
        <SelectTrigger
          size="sm"
          className="w-full sm:w-[150px]"
          aria-label="Filter by status"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
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
