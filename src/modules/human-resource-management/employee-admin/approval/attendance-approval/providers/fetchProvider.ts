import type { AttendanceListResponse, ApprovalAction } from "../type";

const API_BASE = "/api/hrm/employee-admin/approval/attendance-approval";

// Simple in-memory cache
let departmentCache: { department_id: number, department_name: string }[] | null = null;

export async function fetchAttendanceRequests(params?: { 
  startDate?: string; 
  endDate?: string; 
  approvalStatus?: string;
  departmentId?: string;
}): Promise<AttendanceListResponse> {
  const query = new URLSearchParams();
  if (params?.startDate) query.append("startDate", params.startDate);
  if (params?.endDate) query.append("endDate", params.endDate);
  if (params?.approvalStatus) query.append("approvalStatus", params.approvalStatus);
  if (params?.departmentId && params.departmentId !== "all") query.append("departmentId", params.departmentId);

  const response = await fetch(`${API_BASE}?${query.toString()}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || errorData.error || 'Failed to fetch attendance requests');
  }
  return response.json();
}

export async function fetchDepartments(): Promise<{ department_id: number, department_name: string }[]> {
  if (departmentCache) return departmentCache;
  
  const response = await fetch('/api/hrm/employee-admin/approval/attendance-approval/departments');
  if (!response.ok) return [];
  const data = await response.json();
  departmentCache = data.data || [];
  return departmentCache!;
}

export async function approveOrRejectAttendance(
  action: ApprovalAction | ApprovalAction[]
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
    throw new Error(error.error || "Failed to update attendance request");
  }

  return response.json();
}
