import {
  Executive,
  DivisionSalesHead,
  SupervisorPerDivision,
  SalesmanPerSupervisor,
  SystemUser,
  Division,
  Salesman,
  ReviewCommittee
} from "../types";

const PROXY_BASE = "/api/hrm/employee-admin/structure/role-management";

async function request<T>(method: string, endpoint: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${res.status} `);
  }

  if (res.status === 204) return {} as T;
  const json = await res.json();
  // Unwrap Directus data wrapper if present
  return (json.data !== undefined ? json.data : json) as T;
}

// --- Helpers ---
export async function listUsers(): Promise<SystemUser[]> {
  return request<SystemUser[]>("GET", `${PROXY_BASE}/users`);
}

export async function listDivisions(): Promise<Division[]> {
  return request<Division[]>("GET", `${PROXY_BASE}/divisions`);
}

export async function listSalesmen(): Promise<Salesman[]> {
  return request<Salesman[]>("GET", `${PROXY_BASE}/salesmen`);
}

// --- Executives ---
export async function listExecutives(): Promise<Executive[]> {
  return request<Executive[]>("GET", `${PROXY_BASE}/executives`);
}

export async function createExecutive(userId: number): Promise<void> {
  await request("POST", `${PROXY_BASE}/executives`, { user_id: userId });
}

export async function deleteExecutive(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/executives/${id}`);
}

// --- Review Committee ---
export async function listReviewCommittee(): Promise<ReviewCommittee[]> {
  return request<ReviewCommittee[]>("GET", `${PROXY_BASE}/review-committees`);
}

export async function createReviewCommittee(data: Partial<ReviewCommittee>): Promise<void> {
  await request("POST", `${PROXY_BASE}/review-committees`, data);
}

export async function deleteReviewCommittee(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/review-committees/${id}`);
}

// --- Division Heads ---
export async function listDivisionHeads(): Promise<DivisionSalesHead[]> {
  return request<DivisionSalesHead[]>("GET", `${PROXY_BASE}/division-heads`);
}

export async function createDivisionHead(divisionId: number, userId: number): Promise<void> {
  await request("POST", `${PROXY_BASE}/division-heads`, { division_id: divisionId, user_id: userId });
}

export async function deleteDivisionHead(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/division-heads/${id}`);
}

// --- Supervisors ---
export async function listSupervisors(): Promise<SupervisorPerDivision[]> {
  return request<SupervisorPerDivision[]>("GET", `${PROXY_BASE}/supervisors`);
}

export async function createSupervisor(divisionId: number, supervisorId: number): Promise<void> {
  await request("POST", `${PROXY_BASE}/supervisors`, { division_id: divisionId, supervisor_id: supervisorId });
}

export async function deleteSupervisor(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/supervisors/${id}`);
}

// --- Salesmen ---
export async function listSalesmanAssignments(): Promise<SalesmanPerSupervisor[]> {
  return request<SalesmanPerSupervisor[]>("GET", `${PROXY_BASE}/salesman-assignments`);
}

export async function createSalesmanAssignment(supervisorPerDivisionId: number, salesmanId: number): Promise<void> {
  await request("POST", `${PROXY_BASE}/salesman-assignments`, {
    supervisor_per_division_id: supervisorPerDivisionId,
    salesman_id: salesmanId
  });
}

export async function deleteSalesmanAssignment(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/salesman-assignments/${id}`);
}
