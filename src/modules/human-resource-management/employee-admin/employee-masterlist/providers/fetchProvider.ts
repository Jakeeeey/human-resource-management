import { User, Department } from "../types";

const PROXY_BASE = "/api/hrm/employee-admin/employee-master-list";

async function request<T>(method: string, endpoint: string, body?: Record<string, unknown>): Promise<T> {
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
    throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export async function listEmployees(): Promise<User[]> {
  return request<User[]>("GET", `${PROXY_BASE}/employees`);
}

export async function listDepartments(): Promise<Department[]> {
  return request<Department[]>("GET", `${PROXY_BASE}/departments`);
}

export async function deleteEmployee(id: number): Promise<void> {
  await request("DELETE", `${PROXY_BASE}/delete/${id}`);
}

export async function createEmployee(data: Record<string, unknown>): Promise<User> {
  return request<User>("POST", `${PROXY_BASE}/create`, data);
}
