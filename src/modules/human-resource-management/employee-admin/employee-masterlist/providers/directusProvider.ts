import {
  EmployeeFileRecordDisplay,
  EmployeeFileRecordType,
  EmployeeFileRecordList,
  AssetAndEquipment,
  AssetAssignment,
  Company
} from "../types";

const PROXY_BASE = "/api/hrm/employee-admin/employee-master-list";

export async function getEmployeeFileRecordsDirectus(userId: number): Promise<EmployeeFileRecordDisplay[]> {
  const res = await fetch(`${PROXY_BASE}/file-records?filter[user_id][_eq]=${userId}&filter[is_deleted][_eq]=0`);
  if (!res.ok) {
    throw new Error("Failed to fetch employee file records from Directus");
  }
  const json = await res.json();

  return (json.data || []).map((r: {
    id: number;
    record_name?: string;
    file_ref: string;
    list_id?: {
      record_type_id?: { name?: string };
      name?: string;
    };
    description?: string;
    created_at?: string;
    date_created?: string;
  }) => ({
    id: r.id,
    record_name: r.record_name || "Untitled",
    file_ref: r.file_ref,
    type: r.list_id?.record_type_id?.name || "Unknown",
    list_name: r.list_id?.name || "Unknown",
    description: r.description || "",
    created_at: r.created_at || r.date_created || ""
  }));
}

export interface CreateFileRecordPayloadDirectus {
  user_id: number;
  list_id: number;
  record_name: string;
  description?: string;
  file_ref: string;
}

export async function createEmployeeFileRecordDirectus(payload: CreateFileRecordPayloadDirectus) {
  const res = await fetch(`${PROXY_BASE}/file-records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Failed to create employee file record in Directus");
  }
  const json = await res.json();
  return json.data;
}

export async function deleteEmployeeFileRecordDirectus(id: number) {
  const res = await fetch(`${PROXY_BASE}/file-records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_deleted: 1 }),
  });
  if (!res.ok) {
    throw new Error("Failed to soft delete employee file record in Directus");
  }
  const json = await res.json();
  return json.data;
}

export async function getRecordTypesDirectus(): Promise<EmployeeFileRecordType[]> {
  const res = await fetch(`${PROXY_BASE}/record-types`);
  if (!res.ok) {
    throw new Error("Failed to fetch record types from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getRecordListsDirectus(): Promise<EmployeeFileRecordList[]> {
  const res = await fetch(`${PROXY_BASE}/record-lists`);
  if (!res.ok) {
    throw new Error("Failed to fetch record lists from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

// --- Assets and Equipments ---

export async function getEmployeeAssetsDirectus(userId: number, historyAssetIds?: number[]): Promise<AssetAndEquipment[]> {
  let filterStr = `filter[employee][_eq]=${userId}`;

  if (historyAssetIds && historyAssetIds.length > 0) {
    const inIds = historyAssetIds.join(",");
    filterStr = `filter[_or][0][employee][_eq]=${userId}&filter[_or][1][id][_in]=${inIds}`;
  }

  const res = await fetch(`${PROXY_BASE}/assets-and-equipments?${filterStr}`);
  if (!res.ok) {
    throw new Error("Failed to fetch employee assets from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getEmployeeAssetAssignmentsDirectus(userId: number): Promise<AssetAssignment[]> {
  const res = await fetch(`${PROXY_BASE}/asset-assignments?filter[user_id][_eq]=${userId}`);
  if (!res.ok) {
    throw new Error("Failed to fetch employee asset assignments from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getAllAssetAssignmentsDirectus(): Promise<AssetAssignment[]> {
  const res = await fetch(`${PROXY_BASE}/asset-assignments`);
  if (!res.ok) {
    throw new Error("Failed to fetch all asset assignments from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getItemsDirectus(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${PROXY_BASE}/items`);
  if (!res.ok) {
    throw new Error("Failed to fetch items from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getAvailableAssetsDirectus(): Promise<AssetAndEquipment[]> {
  // Assuming all available assets can be fetched without explicit filter,
  // or you could add ?filter[employee][_null]=true if supported.
  const res = await fetch(`${PROXY_BASE}/assets-and-equipments`);
  if (!res.ok) {
    throw new Error("Failed to fetch available assets from Directus");
  }
  const json = await res.json();
  return json.data || [];
}

export interface AssignAssetPayload {
  asset_id: number;
  user_id: number;
  expected_return_date?: string | null;
  condition_on_assignment?: string;
  notes?: string;
}

export async function assignAssetToEmployeeDirectus(payload: AssignAssetPayload) {
  // 1. Create the `asset_assignments` record
  const assignRes = await fetch(`${PROXY_BASE}/asset-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset_id: payload.asset_id,
      user_id: payload.user_id,
      expected_return_date: payload.expected_return_date || null,
      condition_on_assignment: payload.condition_on_assignment,
      notes: payload.notes,
      assignment_status: "Assigned"
      // assigned_by will be injected by proxy
    }),
  });

  if (!assignRes.ok) {
    throw new Error("Failed to create asset assignment");
  }

  // 2. Update the `assets_and_equipment` table
  const updateRes = await fetch(`${PROXY_BASE}/assets-and-equipments/${payload.asset_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      employee: payload.user_id,
      date_acquired: new Date().toISOString(),
      is_active: 1
      // encoder will be injected by proxy
    }),
  });

  if (!updateRes.ok) {
    throw new Error("Failed to update asset assignment flag");
  }

  return true;
}

export interface ReturnAssetPayload {
  assignment_id: number;
  asset_id: number;
  assignment_status: string;
  condition_on_return: string;
  actual_return_date: string;
  notes?: string;
}

export async function returnAssetDirectus(payload: ReturnAssetPayload) {
  // 1. Update the `asset_assignments` record
  const assignRes = await fetch(`${PROXY_BASE}/asset-assignments/${payload.assignment_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actual_return_date: payload.actual_return_date,
      assignment_status: payload.assignment_status,
      condition_on_return: payload.condition_on_return,
      notes: payload.notes
    }),
  });

  if (!assignRes.ok) {
    throw new Error("Failed to update asset assignment for return");
  }

  // 2. Update the `assets_and_equipment` table
  const updateRes = await fetch(`${PROXY_BASE}/assets-and-equipments/${payload.asset_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      is_active: 0,
      employee: null,
      condition: payload.condition_on_return
    }),
  });

  if (!updateRes.ok) {
    throw new Error("Failed to update asset status on return");
  }

  return true;
}

export async function getCompanyDataDirectus(): Promise<Company[]> {
  const res = await fetch(`${PROXY_BASE}/company`);
  if (!res.ok) {
    throw new Error("Failed to fetch company data from Directus");
  }
  const json = await res.json();
  return json.data || [];
}
