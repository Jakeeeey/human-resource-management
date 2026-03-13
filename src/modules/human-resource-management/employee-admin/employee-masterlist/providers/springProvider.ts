/**
 * springProvider.ts
 * Spring Boot API calls for the Employee Masterlist module.
 * Employee creation goes through Spring Boot; file uploads still use Directus.
 */

const PROXY_BASE = "/api/hrm/employee-admin/employee-master-list";

export interface CreateEmployeePayload {
  email: string;
  hashPassword: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  contact: string;
  province: string;
  city: string;
  brgy: string;
  department?: string;
  sssNumber?: string;
  philHealthNumber?: string;
  tinNumber?: string;
  pagibigNumber?: string;
  position: string;
  dateOfHire: string;
  birthday?: string;
  tags?: string;
  image?: string;           // Directus file UUID (stored as reference)
  signature?: string;       // Directus file UUID (stored as reference)
  externalId?: string;
  biometricId?: string;
  rfId?: string;
  admin?: boolean;
  role?: string;
  emergencyContactName?: string;
  emergencyContactNumber?: string;
}

export interface CreateEmployeeResponse {
  success: boolean;
  message?: string;
  // Spring Boot may return more fields — keep loose
  [key: string]: unknown;
}

export async function createEmployeeSpring(
  payload: CreateEmployeePayload
): Promise<CreateEmployeeResponse> {
  const res = await fetch(`${PROXY_BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Serialise the whole error body so callers can extract field-level messages
    throw new Error(JSON.stringify(data));
  }

  return data as CreateEmployeeResponse;
}

export interface UpdateEmployeePayload extends Partial<CreateEmployeePayload> {
  // same fields mostly, with password optional
  id?: number;
  password?: string;
}

export interface UpdateEmployeeResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export async function updateEmployeeSpring(
  id: number,
  payload: UpdateEmployeePayload
): Promise<UpdateEmployeeResponse> {
  const res = await fetch(`${PROXY_BASE}/update/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as UpdateEmployeeResponse;
}

export interface DeleteEmployeeResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export async function deleteEmployeeSpring(
  id: number
): Promise<DeleteEmployeeResponse> {
  const res = await fetch(`${PROXY_BASE}/delete/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data as DeleteEmployeeResponse;
}

