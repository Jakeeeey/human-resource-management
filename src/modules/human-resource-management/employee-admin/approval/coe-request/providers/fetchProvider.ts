import type { COEListResponse, ApprovalAction } from "../type";

const API_BASE = "/api/hrm/employee-admin/approval/coe-request";

export async function fetchCOERequests(): Promise<COEListResponse> {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch COE requests");
  }

  return response.json();
}

export async function approveOrRejectCOERequest(
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
    throw new Error(error.error || "Failed to update COE request");
  }

  return response.json();
}
