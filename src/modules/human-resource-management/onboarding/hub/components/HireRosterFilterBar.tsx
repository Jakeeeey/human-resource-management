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

import { ONBOARDING_OWNER_ROLE } from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import {
  OWNER_ROLE_LABELS,
  phaseLabel,
  ROSTER_STATUS_LABELS,
  type HireRosterFilters,
} from "../rosterData";
import { HIRE_ROSTER_STATUS } from "../types/hire-roster.schema";

// HireRosterFilterBar.tsx — search + status/owner/phase filters for the
// master-detail roster (todo 27). Client-side over the loaded rows (same model
// as `MailOutboxViewer`): no filter is a stage and no request is triggered.

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel} title={ariaLabel} className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...HIRE_ROSTER_STATUS.map((status) => ({
    value: status,
    label: ROSTER_STATUS_LABELS[status],
  })),
];

const OWNER_OPTIONS = [
  { value: "all", label: "All owners" },
  ...ONBOARDING_OWNER_ROLE.map((role) => ({
    value: role,
    label: OWNER_ROLE_LABELS[role],
  })),
];

export function HireRosterFilterBar({
  filters,
  phaseOptions,
  onChange,
  onReset,
}: {
  filters: HireRosterFilters;
  phaseOptions: string[];
  onChange: (next: HireRosterFilters) => void;
  onReset: () => void;
}) {
  const hasActiveFilters =
    filters.query !== "" ||
    filters.status !== "all" ||
    filters.ownerRole !== "all" ||
    filters.phase !== "all";

  const phaseOptionsList = [
    { value: "all", label: "All phases" },
    ...phaseOptions.map((phase) => ({
      value: phase,
      label: phaseLabel(phase),
    })),
  ];

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search
          className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="h-10 pl-8"
          aria-label="Search hires"
          title="Search hires"
          placeholder="Search hire name or employee #…"
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[560px] lg:shrink-0">
        <FilterSelect
          ariaLabel="Filter by status"
          value={filters.status}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          onChange={(value) =>
            onChange({ ...filters, status: value as HireRosterFilters["status"] })
          }
        />
        <FilterSelect
          ariaLabel="Filter by owner"
          value={filters.ownerRole}
          placeholder="All owners"
          options={OWNER_OPTIONS}
          onChange={(value) =>
            onChange({
              ...filters,
              ownerRole: value as HireRosterFilters["ownerRole"],
            })
          }
        />
        <FilterSelect
          ariaLabel="Filter by phase"
          value={filters.phase}
          placeholder="All phases"
          options={phaseOptionsList}
          onChange={(value) => onChange({ ...filters, phase: value })}
        />
      </div>
      <Button
        variant="ghost"
        className="h-10 w-full shrink-0 px-3 lg:w-auto"
        onClick={onReset}
        disabled={!hasActiveFilters}
      >
        Reset
        <X className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
