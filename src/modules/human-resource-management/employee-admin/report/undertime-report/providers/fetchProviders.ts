import type {
  UndertimeRequestWithDetails,
  User,
  Department,
  UndertimeReportFilters,
  PaginationState,
} from "../type";

// ============================================================================
// FETCH DATA (server-side pagination + filters)
// ============================================================================

export interface UndertimeReportParams {
  page: number;
  pageSize: number;
  filters: UndertimeReportFilters;
}

export async function fetchUndertimeReportData(params: UndertimeReportParams) {
  try {
    const { page, pageSize, filters } = params;

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));

    if (filters.searchQuery.trim()) query.set("search", filters.searchQuery.trim());
    if (filters.dateFrom)   query.set("dateFrom",   filters.dateFrom.toISOString().split("T")[0]);
    if (filters.dateTo)     query.set("dateTo",     filters.dateTo.toISOString().split("T")[0]);
    if (filters.departmentId !== null) query.set("departmentId", String(filters.departmentId));
    if (filters.nameFilter)  query.set("nameFilter",  filters.nameFilter);
    if (filters.statusFilter) query.set("statusFilter", filters.statusFilter);

    const response = await fetch(
      `/api/hrm/employee-admin/report/undertime-report?${query.toString()}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch undertime report data");
    }

    const data = await response.json();

    return {
      currentUser:       data.currentUser as User,
      departments:       (data.departments       || []) as Department[],
      undertimeRequests: (data.undertimeRequests || []) as UndertimeRequestWithDetails[],
      pagination:        data.pagination         as PaginationState,
    };
  } catch (err) {
    console.error("Error fetching undertime report data:", err);
    throw err instanceof Error ? err : new Error("Unknown error occurred");
  }
}
