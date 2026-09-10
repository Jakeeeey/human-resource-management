"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { useHireRoster } from "../hooks/useHireRoster";
import {
  EMPTY_HIRE_ROSTER_FILTERS,
  filterHireRosterRows,
  orderPhases,
  type HireRosterFilters,
} from "../rosterData";
import type { HireRosterRow } from "../types/hire-roster.schema";
import { HireRosterDetail } from "./HireRosterDetail";
import { HireRosterDialog } from "./HireRosterDialog";
import { HireRosterFilterBar } from "./HireRosterFilterBar";
import { HireRosterTable } from "./HireRosterTable";

// HireRoster.tsx — the onboarding hub ENTRY (todo 27): a filterable
// master-detail roster over the enriched hire list, replacing the flat tab
// navigation. Master = the six-column table; detail = the selected hire's
// summary. Rows are built from the employee-keyed task engine — never a
// stage-as-tab.

function useIsLargeScreen(): boolean {
  const [large, setLarge] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setLarge(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return large;
}

export function HireRoster() {
  const { rows, loading, error, refresh } = useHireRoster();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = useState<HireRosterFilters>(
    EMPTY_HIRE_ROSTER_FILTERS
  );
  const isLarge = useIsLargeScreen();

  // The URL (`?selected=<userId>`) is the ONE canonical selected hire: the
  // roster's active row and the workspace route param both read from it, so
  // navigating roster -> workspace -> roster keeps the same hire. There is no
  // auto-pick — an absent selection renders the empty-detail placeholder.
  const selectedUserId = useMemo(() => {
    const raw = searchParams.get("selected");
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [searchParams]);

  const filtered = useMemo(
    () => filterHireRosterRows(rows, filters),
    [rows, filters]
  );
  const phaseOptions = useMemo(
    () => orderPhases(rows.flatMap((row) => row.phases)),
    [rows]
  );
  const activeRow = useMemo(
    () => filtered.find((row) => row.userId === selectedUserId) ?? null,
    [filtered, selectedUserId]
  );

  const selectRow = useCallback(
    (row: HireRosterRow | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (row) params.set("selected", String(row.userId));
      else params.delete("selected");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname]
  );

  const handleSelect = (row: HireRosterRow) => {
    selectRow(row);
  };

  const handleReset = () => {
    setFilters(EMPTY_HIRE_ROSTER_FILTERS);
    selectRow(null);
  };

  if (loading) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[560px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {error}
        </p>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => void refresh()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty className="rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users className="h-6 w-6" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No hires in onboarding yet</EmptyTitle>
          <EmptyDescription>
            Hires appear here as soon as their onboarding tasks are created
            after commitment.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-3">
      <HireRosterFilterBar
        filters={filters}
        phaseOptions={phaseOptions}
        onChange={setFilters}
        onReset={handleReset}
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,13fr)_minmax(0,9fr)]">
        <HireRosterTable
          rows={filtered}
          activeRow={activeRow}
          onSelect={handleSelect}
        />
        <div className="hidden min-h-0 lg:flex lg:flex-col">
          <div className="flex h-[560px] flex-col">
            {activeRow ? (
              <HireRosterDetail
                row={activeRow}
                workspaceHref={`/hrm/onboarding/${activeRow.userId}`}
              />
            ) : (
              <p className="min-h-0 flex-1 text-sm text-muted-foreground">
                Select a hire to see their onboarding summary.
              </p>
            )}
          </div>
        </div>
      </div>

      <HireRosterDialog
        row={isLarge ? null : activeRow}
        workspaceHref={
          activeRow ? `/hrm/onboarding/${activeRow.userId}` : undefined
        }
        onClose={() => selectRow(null)}
      />
    </div>
  );
}
