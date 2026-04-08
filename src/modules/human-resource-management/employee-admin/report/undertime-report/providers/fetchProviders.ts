import type {
  UndertimeRequestWithDetails,
  User,
  Department,
} from "../type";

// ============================================================================
// FETCH DATA
// ============================================================================

export async function fetchUndertimeReportData() {
  try {
    const response = await fetch("/api/hrm/employee-admin/report/undertime-report", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch undertime report data");
    }

    const data = await response.json();

    return {
      currentUser: data.currentUser as User,
      departments: (data.departments || []) as Department[],
      undertimeRequests: (data.undertimeRequests || []) as UndertimeRequestWithDetails[],
    };
  } catch (err) {
    console.error("Error fetching undertime report data:", err);
    throw err instanceof Error ? err : new Error("Unknown error occurred");
  }
}
