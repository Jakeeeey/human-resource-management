import {
  Executive,
  DivisionSalesHead,
  SupervisorPerDivision,
  SalesmanPerSupervisor,
  SystemUser,
  Division,
  Salesman,
  ReviewCommittee,
  ExpenseReviewCommittee,
  TAApprover,
  Department
} from "../types";

const PROXY_BASE = "/api/hrm/employee-admin/structure/role-management";

async function request<T>(method: string, endpoint: string, body?: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const url = method === "GET" 
    ? (endpoint.includes('?') ? `${endpoint}&_t=${Date.now()}` : `${endpoint}?_t=${Date.now()}`)
    : endpoint;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${res.status} `);
  }

  if (res.status === 204) return {} as T;
  const json = await res.json();
  // Unwrap common data wrappers
  if (json.data !== undefined) return json.data as T;
  if (json.departments !== undefined) return json.departments as T;
  if (json.users !== undefined) return json.users as T;
  if (json.divisions !== undefined) return json.divisions as T;
  return json as T;
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

export async function listDepartments(): Promise<Department[]> {
  return request<Department[]>("GET", `${PROXY_BASE}/departments`);
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

// --- Expense Review Committee ---
export async function listExpenseReviewCommittee(): Promise<ExpenseReviewCommittee[]> {
  return request<ExpenseReviewCommittee[]>("GET", `${PROXY_BASE}/expense-review-committees`);
}

export async function createExpenseReviewCommittee(data: Partial<ExpenseReviewCommittee>): Promise<void> {
  await request("POST", `${PROXY_BASE}/expense-review-committees`, data);
}

export async function deleteExpenseReviewCommittee(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/expense-review-committees/${id}`);
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

// --- TA Draft Approvers ---
export async function listTAApprovers(): Promise<TAApprover[]> {
  return request<TAApprover[]>("GET", `${PROXY_BASE}/ta-draft-approvers`);
}

export async function createTAApprover(data: Partial<TAApprover>): Promise<void> {
  await request("POST", `${PROXY_BASE}/ta-draft-approvers`, data);
}

export async function deleteTAApprover(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/ta-draft-approvers/${id}`);
}
