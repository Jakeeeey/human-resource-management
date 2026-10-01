"use client";

import { useCallback, useMemo, useState } from "react";

import type { PaperworkTemplate } from "../types/paperwork-template.schema";

// useTemplateTableControls.ts — the single source of truth for the paperwork
// template table's client controls: title/company text search, active status,
// pagination, and the derived visible window. Mirrors the requirements module's
// `useTableControls` so both list surfaces behave identically. The paperwork
// catalog has one entity and no reorder column, and its columns are not
// sortable, so only the controls this table actually renders live here.

/** Active status filter; `all` is unfiltered. */
export type TemplateStatusFilter = "all" | "active" | "inactive";

/** Company display names per template id, used for the search haystack. */
export type TemplateCompanyNames = ReadonlyMap<number, readonly string[]>;

/** The full control surface + derived window the template table consumes. */
export interface TemplateTableControls {
  search: string;
  setSearch: (value: string) => void;
  status: TemplateStatusFilter;
  setStatus: (value: TemplateStatusFilter) => void;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  /** The current page slice, in display order. */
  visibleRows: PaperworkTemplate[];
  /** Rows surviving the filters (before pagination). */
  filteredCount: number;
  /** All rows in the catalog (before filters). */
  totalCount: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  /** True when the search or status filter is active. */
  isFiltered: boolean;
  clearFilters: () => void;
}

/**
 * Owns the template table's search/status/page state and derives its window.
 * @param rows The full catalog list in fetched order.
 * @param companyNamesByTemplate Company display names per template id (search haystack).
 * @returns Control state, handlers, and the visible/filtered/paginated window.
 */
export function useTemplateTableControls(
  rows: readonly PaperworkTemplate[],
  companyNamesByTemplate: TemplateCompanyNames
): TemplateTableControls {
  const [search, setSearchRaw] = useState("");
  const [status, setStatusRaw] = useState<TemplateStatusFilter>("all");
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);

  // Every control that changes the result set returns the user to page 1 so the
  // new first row is visible instead of an out-of-range page.
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPageRaw(1);
  }, []);
  const setStatus = useCallback((value: TemplateStatusFilter) => {
    setStatusRaw(value);
    setPageRaw(1);
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === "" && status === "all") return rows;
    return rows.filter((row) => {
      if (needle !== "") {
        const names = companyNamesByTemplate.get(row.id) ?? [];
        const haystack = [row.title, ...names].join(" ").toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (status !== "all" && row.is_active !== (status === "active")) {
        return false;
      }
      return true;
    });
  }, [rows, search, status, companyNamesByTemplate]);

  const totalCount = rows.length;
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Derive the clamped page instead of storing it: after create/delete/filter a
  // shrinking list can leave the raw page out of range, and the derived value
  // can never show an empty page.
  const safePage = Math.min(Math.max(1, page), totalPages);

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const setPage = useCallback((next: number) => {
    setPageRaw(Math.max(1, next));
  }, []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);
  const clearFilters = useCallback(() => {
    setSearchRaw("");
    setStatusRaw("all");
    setPageRaw(1);
  }, []);

  const isFiltered = search.trim() !== "" || status !== "all";
  const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filteredCount);

  return {
    search,
    setSearch,
    status,
    setStatus,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    visibleRows,
    filteredCount,
    totalCount,
    totalPages,
    rangeStart,
    rangeEnd,
    isFiltered,
    clearFilters,
  };
}
