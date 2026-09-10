import { formatDateLong, titleCase } from "@/lib/utils";

import type {
  OnboardingOwnerRole,
  OnboardingTaskStatus,
} from "@/modules/human-resource-management/onboarding/types/onboarding-task.schema";

import type {
  HireRosterRow,
  HireRosterStatus,
} from "./types/hire-roster.schema";

// rosterData.ts — display vocabulary + client-side filters for the onboarding
// hub roster (todo 27). No I/O and no React: the pure join lives in
// `rosterBuilder.ts`; this file is what the components read.

export const PHASE_ORDER = [
  "documents",
  "orientation",
  "training",
  "equipment",
] as const;

export const PHASE_LABELS: Record<string, string> = {
  documents: "Documents",
  orientation: "Orientation",
  training: "Training",
  equipment: "Equipment",
};

export const OWNER_ROLE_LABELS: Record<OnboardingOwnerRole, string> = {
  hr: "HR",
  department: "Department",
  hiree: "Hiree",
  system: "System",
};

export const ROSTER_STATUS_LABELS: Record<HireRosterStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
};

export const TASK_STATUS_LABELS: Record<OnboardingTaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  na: "N/A",
};

/** Structurally compatible with `StatusTone` in `components/ui/status-badge`. */
export type RosterStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "info"
  | "destructive";

export function rosterStatusTone(status: HireRosterStatus): RosterStatusTone {
  switch (status) {
    case "complete":
      return "success";
    case "blocked":
      return "destructive";
    case "in_progress":
      return "info";
    default:
      return "neutral";
  }
}

export function taskStatusTone(status: OnboardingTaskStatus): RosterStatusTone {
  switch (status) {
    case "done":
      return "success";
    case "in_progress":
      return "info";
    case "blocked":
      return "destructive";
    default:
      return "neutral";
  }
}

/** Display name for a phase key; falls back to title-cased raw value. */
export function phaseLabel(phase: string | null): string {
  if (!phase) return "—";
  return PHASE_LABELS[phase] ?? titleCase(phase.replace(/_/g, " "));
}

/** Brings arbitrary phase keys into the canonical onboarding order. */
export function orderPhases(phases: readonly string[]): string[] {
  const present = new Set(phases);
  const known = PHASE_ORDER.filter((phase) => present.has(phase));
  const extra = [...present]
    .filter((phase) => !(PHASE_ORDER as readonly string[]).includes(phase))
    .sort();
  return [...known, ...extra];
}

export type HireRosterStatusFilter = HireRosterStatus | "all";

export interface HireRosterFilters {
  query: string;
  status: HireRosterStatusFilter;
  ownerRole: OnboardingOwnerRole | "all";
  phase: string | "all";
}

export const EMPTY_HIRE_ROSTER_FILTERS: HireRosterFilters = {
  query: "",
  status: "all",
  ownerRole: "all",
  phase: "all",
};

/**
 * Client-side filter over the loaded roster rows (no new API params — the
 * same shape `MailOutboxViewer` uses): name/id substring, roll-up status,
 * next-action owner, and phase membership.
 */
export function filterHireRosterRows(
  rows: readonly HireRosterRow[],
  filters: HireRosterFilters
): HireRosterRow[] {
  const needle = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.ownerRole !== "all" && row.ownerRole !== filters.ownerRole) {
      return false;
    }
    if (filters.phase !== "all" && !row.phases.includes(filters.phase)) {
      return false;
    }
    if (needle !== "") {
      const haystack = `${row.name} ${row.userId}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a `YYYY-MM-DD` due date for display (PH-friendly, no TZ drift). */
export function formatDueDate(value: string | null): string {
  if (!value) return "—";
  const date = parseLocalDate(value);
  return date ? formatDateLong(date) : value;
}

/** True when a due date is strictly before today (local midnight). */
export function isDateOverdue(
  value: string | null,
  now: Date = new Date()
): boolean {
  if (!value) return false;
  const due = parseLocalDate(value);
  if (!due) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}
