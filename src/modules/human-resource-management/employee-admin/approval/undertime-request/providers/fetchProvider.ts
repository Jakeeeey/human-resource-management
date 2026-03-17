import type { UndertimeListResponse, ApprovalAction } from "../type";

const API_BASE = "/api/hrm/employee-admin/approval/undertime-request";

export async function fetchUndertimeRequests(): Promise<UndertimeListResponse> {
  const response = await fetch(API_BASE, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch undertime requests");
  }

  return response.json();
}

export async function approveOrRejectUndertimeRequest(
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
    throw new Error(error.error || "Failed to update undertime request");
  }

  return response.json();
}
