import type { TopsheetDataResponse } from "../type";

const API_BASE = "/api/hrm/employee-admin/report/leave-topsheet";

export async function fetchLeaveTopsheet(
  startDate?: string,
  endDate?: string,
  departmentId?: string
): Promise<TopsheetDataResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  if (departmentId && departmentId !== "all") params.append("department_id", departmentId);

  const url = `${API_BASE}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch leave topsheet");
  }

  return response.json();
}
