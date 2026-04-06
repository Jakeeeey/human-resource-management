import type { LeaveListResponse, ApprovalAction } from "../type";

const API_BASE = "/api/hrm/employee-admin/approval/leave-request";

export async function fetchLeaveRequests(): Promise<LeaveListResponse> {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch leave requests");
  }

  return response.json();
}

export async function approveOrRejectLeaveRequest(
  action: ApprovalAction
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(API_BASE, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to update leave request");
  }

  return response.json();
}
