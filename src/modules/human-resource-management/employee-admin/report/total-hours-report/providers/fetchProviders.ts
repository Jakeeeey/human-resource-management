import type {
  TotalHoursRecord,
  TotalHoursSummary,
  User,
  Department,
  TotalHoursReportFilters,
  PaginationState,
  TotalHoursReportApiResponse,
} from "../type";

export interface FetchTotalHoursParams {
  page: number;
  pageSize: number;
  filters: TotalHoursReportFilters;
}

export async function fetchTotalHoursReportData(
  params: FetchTotalHoursParams
): Promise<TotalHoursReportApiResponse> {
  try {
    const { page, pageSize, filters } = params;

    const query = new URLSearchParams();
    query.set("page", String(page));
    query.set("pageSize", String(pageSize));

    if (filters.searchQuery.trim()) {
      query.set("search", filters.searchQuery.trim());
    }
    if (filters.dateFrom) {
      query.set("dateFrom", filters.dateFrom.toISOString().split("T")[0]);
    }
    if (filters.dateTo) {
      query.set("dateTo", filters.dateTo.toISOString().split("T")[0]);
    }
    if (filters.departmentId !== null) {
      query.set("departmentId", String(filters.departmentId));
    }
    if (filters.nameFilter) {
      query.set("nameFilter", filters.nameFilter);
    }
    if (filters.approvalStatus) {
      query.set("approvalStatus", filters.approvalStatus);
    }

    const response = await fetch(
      `/api/hrm/employee-admin/report/total-hours-report?${query.toString()}`,
      { credentials: "include" }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.details || "Failed to fetch total hours report");
    }

    const data = await response.json();

    return {
      data: (data.data || []) as TotalHoursRecord[],
      matrix: (data.matrix || { dates: [], employees: [], departmentTotals: {} }) as any,
      summary: (data.summary || {
        totalWorkMinutes: 0,
        totalLateMinutes: 0,
        totalUndertimeMinutes: 0,
        totalOvertimeMinutes: 0,
        totalDays: 0,
        uniqueEmployees: 0,
      }) as TotalHoursSummary,
      departments: (data.departments || []) as Department[],
      currentUser: data.currentUser as User | null,
      employeeNames: (data.employeeNames || []) as string[],
      isHRAdmin: Boolean(data.isHRAdmin),
      pagination: (data.pagination || {
        currentPage: page,
        pageSize,
        totalItems: 0,
        totalPages: 1,
      }) as PaginationState,
    };
  } catch (error) {
    console.error("Error in fetchTotalHoursReportData:", error);
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}
