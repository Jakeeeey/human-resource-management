"use client";

import { useCallback, useMemo, useState } from "react";

// useTableControls.ts — the single source of truth for one requirements table's
// client controls: text search, role facet, required/active status, sorting,
// pagination, and the derived visible window. Every section renders through
// this hook so pagination + filtering + sorting stay consistent and the row
// count text always describes the filtered set. Reorder is only safe on the
// untouched default `sort_order` view, so `canReorder` is derived here too.

/** Ascending or descending sort direction. */
export type SortDirection = "asc" | "desc";
/** Required status filter; `all` is unfiltered. */
export type StatusFilter = "all" | "required" | "optional";
/** Active status filter; `all` is unfiltered. */
export type ActiveFilter = "all" | "active" | "inactive";
/** A value a column can be sorted by. */
export type SortValue = string | number | boolean;

/** Active sort column + direction; `null` means the fetched `sort_order`. */
export interface TableSort {
  key: string;
  direction: SortDirection;
}

/** Per-catalog accessors the hook needs to filter + sort generic rows. */
export interface TableControlsConfig<T> {
  /** Haystack matched against the search box (case-insensitive). */
  searchText: (row: T) => string;
  /** Raw facet value per row; omit for catalogs without a facet. */
  getFacetValue?: (row: T) => string;
  /** Required flag per row. */
  getRequiredValue: (row: T) => boolean;
  /** Active flag per row. */
  getActiveValue: (row: T) => boolean;
  /** Comparable value per sortable column key. */
  sortAccessors: Readonly<Record<string, (row: T) => SortValue>>;
}

/** The full control surface + derived window one table consumes. */
export interface TableControls<T> {
  search: string;
  setSearch: (value: string) => void;
  facet: string;
  setFacet: (value: string) => void;
  required: StatusFilter;
  setRequired: (value: StatusFilter) => void;
  active: ActiveFilter;
  setActive: (value: ActiveFilter) => void;
  sort: TableSort | null;
  toggleSort: (key: string) => void;
  canSort: (key: string) => boolean;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  /** The current page slice, in display order. */
  visibleRows: T[];
  /** Rows surviving the filters (before pagination). */
  filteredCount: number;
  /** All rows in the catalog (before filters). */
  totalCount: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  /** True when any search/facet/status filter is active. */
  isFiltered: boolean;
  /** True only on the default `sort_order` view with no filters. */
  canReorder: boolean;
  clearFilters: () => void;
}

/** Sentinel facet value meaning "no facet filter". */
export const ALL_FACET = "all";

/** Compares two sort values without throwing on mixed primitive kinds. */
function compareValues(a: SortValue, b: SortValue): number {
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * Owns one table's search/facet/status/sort/page state and derives its window.
 * @param rows The full catalog list in fetched `sort_order`.
 * @param config Accessors for search text, facet, statuses, and sort columns.
 * @returns Control state, handlers, and the visible/filtered/paginated window.
 */
export function useTableControls<T>(
  rows: readonly T[],
  config: TableControlsConfig<T>
): TableControls<T> {
  const [search, setSearchRaw] = useState("");
  const [facet, setFacetRaw] = useState<string>(ALL_FACET);
  const [required, setRequiredRaw] = useState<StatusFilter>("all");
  const [active, setActiveRaw] = useState<ActiveFilter>("all");
  const [sort, setSort] = useState<TableSort | null>(null);
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);

  // Every control that changes the result set returns the user to page 1 so the
  // new first row is visible instead of an out-of-range page.
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPageRaw(1);
  }, []);
  const setFacet = useCallback((value: string) => {
    setFacetRaw(value);
    setPageRaw(1);
  }, []);
  const setRequired = useCallback((value: StatusFilter) => {
    setRequiredRaw(value);
    setPageRaw(1);
  }, []);
  const setActive = useCallback((value: ActiveFilter) => {
    setActiveRaw(value);
    setPageRaw(1);
  }, []);

  // Clicking a header cycles asc -> desc -> default (the fetched order), so the
  // user always has a path back to the reorderable view.
  const toggleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev === null || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
    setPageRaw(1);
  }, []);

  const canSort = useCallback(
    (key: string) => config.sortAccessors[key] !== undefined,
    [config]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const getFacetValue = config.getFacetValue;
    const facetActive = getFacetValue !== undefined && facet !== ALL_FACET;
    if (
      needle === "" &&
      !facetActive &&
      required === "all" &&
      active === "all"
    ) {
      return rows;
    }
    return rows.filter((row) => {
      if (needle !== "" && !config.searchText(row).toLowerCase().includes(needle)) {
        return false;
      }
      if (facetActive && getFacetValue(row) !== facet) return false;
      if (
        required !== "all" &&
        config.getRequiredValue(row) !== (required === "required")
      ) {
        return false;
      }
      if (
        active !== "all" &&
        config.getActiveValue(row) !== (active === "active")
      ) {
        return false;
      }
      return true;
    });
  }, [rows, search, facet, required, active, config]);

  const sorted = useMemo(() => {
    if (sort === null) return filtered;
    const accessor = config.sortAccessors[sort.key];
    if (accessor === undefined) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => factor * compareValues(accessor(a), accessor(b))
    );
  }, [filtered, sort, config]);

  const totalCount = rows.length;
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Derive the clamped page instead of storing it: after create/delete/filter a
  // shrinking list can leave the raw page out of range, and the derived value
  // can never show an empty page.
  const safePage = Math.min(Math.max(1, page), totalPages);

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  const setPage = useCallback((next: number) => {
    setPageRaw(Math.max(1, next));
  }, []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);
  const clearFilters = useCallback(() => {
    setSearchRaw("");
    setFacetRaw(ALL_FACET);
    setRequiredRaw("all");
    setActiveRaw("all");
    setPageRaw(1);
  }, []);

  const isFiltered =
    search.trim() !== "" ||
    facet !== ALL_FACET ||
    required !== "all" ||
    active !== "all";
  const canReorder = !isFiltered && sort === null;
  const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filteredCount);

  return {
    search,
    setSearch,
    facet,
    setFacet,
    required,
    setRequired,
    active,
    setActive,
    sort,
    toggleSort,
    canSort,
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
    canReorder,
    clearFilters,
  };
}
