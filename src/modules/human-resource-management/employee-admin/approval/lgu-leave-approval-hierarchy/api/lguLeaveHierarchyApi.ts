import {
  LguLeaveApprover,
  DepartmentInfo,
  UserInfo,
  CreateApproverInput,
  UpdateApproverInput,
  SetupDepartmentHierarchyInput,
  BatchApplyStandardApproversInput,
  LguLeaveHierarchyFilterParams,
} from "../types";

const BASE_URL = "/api/hrm/employee-admin/approval/lgu-leave-approval-hierarchy";

export async function fetchHierarchyData(filters?: LguLeaveHierarchyFilterParams): Promise<{
  data: LguLeaveApprover[];
  departments: DepartmentInfo[];
  users: UserInfo[];
  total: number;
}> {
  const params = new URLSearchParams();
  if (filters?.departmentId && filters.departmentId !== "all") {
    params.set("departmentId", filters.departmentId);
  }
  if (filters?.level && filters.level !== "all") {
    params.set("level", filters.level);
  }
  if (filters?.search) {
    params.set("search", filters.search);
  }

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to load approval hierarchy");
  }

  return {
    data: json.data || [],
    departments: json.departments || [],
    users: json.users || [],
    total: json.total || 0,
  };
}

export async function createApproverApi(payload: CreateApproverInput): Promise<LguLeaveApprover> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to create approver assignment");
  }

  return json.data;
}

export async function updateApproverApi(payload: UpdateApproverInput): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to update approver assignment");
  }
}

export async function deleteApproverApi(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}?id=${id}`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to delete approver assignment");
  }
}

export async function setupDepartmentHierarchyApi(
  payload: SetupDepartmentHierarchyInput
): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "setup-department",
      ...payload,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to configure department hierarchy");
  }
}

export async function batchApplyStandardApproversApi(
  payload: BatchApplyStandardApproversInput
): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "batch-standard",
      ...payload,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to batch apply standard approvers");
  }
}

