import type {
  OvertimeRequestWithDetails,
  User,
  Department,
} from "../type";

// ============================================================================
// FETCH DATA
// ============================================================================

export async function fetchOvertimeReportData() {
  try {
    const response = await fetch("/api/hrm/employee-admin/report/overtime-report", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch overtime report data");
    }

    const data = await response.json();

    return {
      currentUser: data.currentUser as User,
      departments: (data.departments || []) as Department[],
      overtimeRequests: (data.overtimeRequests || []) as OvertimeRequestWithDetails[],
    };
  } catch (err) {
    console.error("Error fetching overtime report data:", err);
    throw err instanceof Error ? err : new Error("Unknown error occurred");
  }
}
