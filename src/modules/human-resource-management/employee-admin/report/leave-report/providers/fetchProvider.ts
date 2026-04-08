import type {
  LeaveRequestWithDetails,
  User,
  Department,
} from "../type";

// ============================================================================
// FETCH DATA
// ============================================================================

export async function fetchLeaveReportData() {
  try {
    const response = await fetch("/api/hrm/employee-admin/report/leave-report", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch leave report data");
    }

    const data = await response.json();

    return {
      currentUser: data.currentUser as User,
      departments: (data.departments || []) as Department[],
      leaveRequests: (data.leaveRequests || []) as LeaveRequestWithDetails[],
    };
  } catch (err) {
    console.error("Error fetching leave report data:", err);
    throw err instanceof Error ? err : new Error("Unknown error occurred");
  }
}
