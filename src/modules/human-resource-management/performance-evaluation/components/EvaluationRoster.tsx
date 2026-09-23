"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useEvaluationRoster } from "../hooks/useEvaluationRoster";
import type { EvaluationScope } from "../providers/evaluationClient";
import type { RosterRow } from "../types/performance-evaluation.schema";
import { EvaluationRosterFilterBar } from "./EvaluationRosterFilterBar";
import { EvaluationRosterPanel } from "./EvaluationRosterPanel";
import { EvaluationRosterTable } from "./EvaluationRosterTable";

const SCOPE_COPY: Record<
  EvaluationScope,
  { title: string; description: string }
> = {
  hr: {
    title: "Performance evaluation",
    description:
      "All employees on probation — review deadlines, status, and what happens next.",
  },
  head: {
    title: "Department evaluation",
    description:
      "Your department's probation roster — review deadlines, status, and what happens next.",
  },
};

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function RosterSkeleton() {
  return (
    <div
      className="grid gap-4"
      role="status"
      aria-label="Loading evaluation roster"
    >
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-[58px] w-full" />
      <div className="data-grid">
        <ul className="max-h-[560px] divide-y divide-border overflow-auto xl:hidden">
          {SKELETON_ROWS.map((index) => (
            <li key={index} className="flex flex-col gap-2.5 p-4">
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-1 h-3 w-1/2" />
                </span>
                <Skeleton className="h-4 w-4 shrink-0" />
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </span>
              <span className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="col-span-2 h-16 w-full" />
              </span>
            </li>
          ))}
        </ul>

        <div className="hidden max-h-[560px] overflow-auto xl:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="td-num">Date hired</TableHead>
                <TableHead>Due dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SKELETON_ROWS.map((index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="td-num">
                    <Skeleton className="ml-auto h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-1 h-3 w-24" />
                    <Skeleton className="mt-1 h-3 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-8 w-44" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvaluationRoster({ scope }: { scope: EvaluationScope }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [showRegular, setShowRegular] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { rows, loading, error, refresh } = useEvaluationRoster(scope, {
    includeRegular: showRegular,
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const copy = SCOPE_COPY[scope];

  const selectedUserId = useMemo(() => {
    const raw = searchParams.get("selected");
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [searchParams]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of rows) {
      if (row.department_name && row.department_name.trim() !== "") {
        names.add(row.department_name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const sorted = useMemo(() => {
    const overdue = rows.filter((row) => row.is_overdue);
    const rest = rows.filter((row) => !row.is_overdue);
    return [...overdue, ...rest];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((row) => {
      if (department !== "all" && row.department_name !== department) {
        return false;
      }
      if (
        q &&
        !`${row.full_name} ${row.position ?? ""}`.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [sorted, query, department]);

  const activeRow = useMemo(
    () => sorted.find((row) => row.user_id === selectedUserId) ?? null,
    [sorted, selectedUserId]
  );

  const selectRow = useCallback(
    (row: RosterRow | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (row) params.set("selected", String(row.user_id));
      else params.delete("selected");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [searchParams, router, pathname]
  );

  const filtersActive =
    query.trim() !== "" || department !== "all" || showRegular;

  const clearFilters = useCallback(() => {
    setQuery("");
    setDepartment("all");
    setShowRegular(false);
    setPage(1);
    selectRow(null);
  }, [selectRow]);

  if (loading) {
    return <RosterSkeleton />;
  }

  if (error) {
    return (
      <div className="grid gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not load the evaluation roster</AlertTitle>
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold tabular-nums text-foreground">
            {filtered.length}
          </span>
          {filtered.length === rows.length ? (
            <> {filtered.length === 1 ? "employee" : "employees"}</>
          ) : (
            <>
              {" "}
              of{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {rows.length}
              </span>{" "}
              employees
            </>
          )}
        </p>
      </div>

      <EvaluationRosterFilterBar
        query={query}
        department={department}
        departmentOptions={departmentOptions}
        showRegular={showRegular}
        filtersActive={filtersActive}
        onQueryChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        onDepartmentChange={(value) => {
          setDepartment(value);
          setPage(1);
        }}
        onShowRegularChange={(value) => {
          setShowRegular(value);
          setPage(1);
        }}
        onClear={clearFilters}
      />

      <EvaluationRosterTable
        rows={filtered}
        scope={scope}
        activeUserId={activeRow?.user_id ?? null}
        onSelect={selectRow}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        totalCount={rows.length}
        filtersActive={filtersActive}
        onClearFilters={clearFilters}
      />

      <EvaluationRosterPanel
        open={activeRow !== null}
        onOpenChange={(next) => {
          if (!next) selectRow(null);
        }}
        row={activeRow}
        workspaceHref={
          activeRow
            ? scope === "hr"
              ? `/hrm/performance-evaluation/${activeRow.user_id}`
              : `/hrm/department-evaluation/${activeRow.user_id}`
            : undefined
        }
      />
    </div>
  );
}
