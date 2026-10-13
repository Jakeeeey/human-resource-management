import type {
  EmployeeOption,
  ServiceRecordDataResponse,
  ServiceRecordEntry,
  ServiceRecordSetting,
} from "../type";

const BASE_URL = "/api/hrm/employee-admin/service-record";

export async function fetchEmployeeOptions(search: string = ""): Promise<EmployeeOption[]> {
  const url = `${BASE_URL}?action=employees${search ? `&search=${encodeURIComponent(search)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load employee list");
  const json = await res.json();
  return json.data || [];
}

export async function fetchServiceRecordData(userId: number): Promise<ServiceRecordDataResponse> {
  const res = await fetch(`${BASE_URL}?userId=${userId}`);
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || "Failed to load service record");
  }
  const json = await res.json();
  return json.data;
}

export async function updateEmployeeHeader(
  userId: number,
  data: {
    user_maiden_name?: string | null;
    user_bday?: string | null;
    user_birth_place?: string | null;
    user_bp_number?: string | null;
    separation_date?: string | null;
    separation_cause?: string | null;
  }
): Promise<void> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_employee_header",
      user_id: userId,
      ...data,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update employee details");
  }
}

export async function createServiceRecordEntry(
  entry: Omit<ServiceRecordEntry, "service_record_id">
): Promise<ServiceRecordEntry> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add service record entry");
  }
  const json = await res.json();
  return json.data;
}

export async function updateServiceRecordEntry(
  serviceRecordId: number,
  entry: Partial<ServiceRecordEntry>
): Promise<ServiceRecordEntry> {
  const res = await fetch(`${BASE_URL}/${serviceRecordId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update service record entry");
  }
  const json = await res.json();
  return json.data;
}

export async function deleteServiceRecordEntry(serviceRecordId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/${serviceRecordId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete service record entry");
  }
}

export async function fetchServiceRecordSettings(): Promise<ServiceRecordSetting> {
  const res = await fetch(`${BASE_URL}/settings`);
  if (!res.ok) throw new Error("Failed to load settings");
  const json = await res.json();
  return json.data;
}

export async function updateServiceRecordSettings(
  settings: Partial<ServiceRecordSetting>
): Promise<ServiceRecordSetting> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update settings");
  }
  const json = await res.json();
  return json.data;
}
