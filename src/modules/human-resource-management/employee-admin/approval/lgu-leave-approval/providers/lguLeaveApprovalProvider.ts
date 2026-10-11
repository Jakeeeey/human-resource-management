import {
  LguLeaveFilterParams,
  LguLeaveListResponse,
  LguLeaveActionPayload,
  ApprovalHistoryEntry,
  LguLeaveRequest,
} from "../types";

const API_BASE = "/api/hrm/employee-admin/approval/lgu-leave-approval";

export async function fetchLguLeaveRequests(
  params?: LguLeaveFilterParams
): Promise<LguLeaveListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.append("status", params.status);
  if (params?.departmentId && params.departmentId !== "all") query.append("departmentId", params.departmentId);
  if (params?.leaveType && params.leaveType !== "all") query.append("leaveType", params.leaveType);
  if (params?.search) query.append("search", params.search);
  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);

  const res = await fetch(`${API_BASE}?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load LGU leave approval requests");
  }

  return res.json();
}

export async function submitLguLeaveAction(
  action: LguLeaveActionPayload
): Promise<{ success: boolean; message: string; data: LguLeaveRequest }> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit leave approval action");
  }

  return res.json();
}

export async function fetchLguLeaveHistory(
  requestId: number
): Promise<ApprovalHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/history?requestId=${requestId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  return json.data || [];
}
