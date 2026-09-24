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
import { Switch } from "@/components/ui/switch";

export function EvaluationRosterFilterBar({
  query,
  department,
  departmentOptions,
  showRegular,
  filtersActive,
  onQueryChange,
  onDepartmentChange,
  onShowRegularChange,
  onClear,
}: {
  query: string;
  department: string;
  departmentOptions: readonly string[];
  showRegular: boolean;
  filtersActive: boolean;
  onQueryChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onShowRegularChange: (value: boolean) => void;
  onClear: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Roster filters"
      className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card p-2 shadow-sm lg:flex-row lg:items-center"
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-10 bg-background pl-8"
          aria-label="Search employees"
          title="Search employees"
          placeholder="Search name or position…"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
        <Select value={department} onValueChange={onDepartmentChange}>
          <SelectTrigger
            aria-label="Filter by department"
            className="h-10 bg-background sm:w-52"
          >
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">All departments</SelectItem>
            {departmentOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3">
          <Switch
            id="evaluation-roster-show-regular"
            checked={showRegular}
            onCheckedChange={onShowRegularChange}
          />
          <label
            htmlFor="evaluation-roster-show-regular"
            className="cursor-pointer whitespace-nowrap text-sm text-muted-foreground"
          >
            Show regular
          </label>
        </div>
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 shrink-0 px-3 text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
