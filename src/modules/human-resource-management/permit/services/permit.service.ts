import {
  PermitTypeItem,
  CompanyPermitRecord,
  CompanyPermitData,
  PermitHealthLevel,
  PermitCatalogSlot,
  PermitFormData,
} from "../types/permit.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (DIRECTUS_TOKEN) {
    headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  }
  return headers;
};

const normalizeTypeName = (str?: string | null): string => {
  if (!str) return "";
  return str.toLowerCase().replace(/['"`\s\-_.]/g, "").trim();
};

const parseDateOnly = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const clean = dateStr.substring(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Resolves the Company ID from company_list:
 * Priority 1: company_list record where is_default == 1
 * Priority 2: Fallback match of NEXT_PUBLIC_API_BASE_URL against company.directus
 */
export const getDefaultCompanyId = async (): Promise<number | null> => {
  try {
    // 1. Try is_default == 1
    const resDefault = await fetch(
      `${API_BASE_URL}/items/company_list?filter[is_default][_eq]=1&limit=1`,
      { method: "GET", headers: getHeaders(), cache: "no-store" }
    );

    if (resDefault.ok) {
      const json = await resDefault.json();
      const first = json.data?.[0];
      if (first && first.company_id) {
        return Number(first.company_id);
      }
    }

    // 2. Fallback: match by directus URL (host/port) from company_list
    const resAll = await fetch(`${API_BASE_URL}/items/company_list?limit=-1`, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (resAll.ok) {
      const json = await resAll.json();
      const list: Array<Record<string, unknown>> = json.data || [];
      const cleanBase = API_BASE_URL.replace(/https?:\/\//, "").replace(/\/$/, "");

      for (const comp of list) {
        const directusUrl = String(comp.directus || "").replace(/https?:\/\//, "").replace(/\/$/, "");
        if (directusUrl && (cleanBase.includes(directusUrl) || directusUrl.includes(cleanBase))) {
          return Number(comp.company_id);
        }
      }

      // If still not matched, take the first company
      if (list.length > 0 && list[0].company_id) {
        return Number(list[0].company_id);
      }
    }

    return null;
  } catch (err) {
    console.error("Error resolving default company_id:", err);
    return null;
  }
};

/**
 * Server-side Aggregator:
 * Fetches permit_types and permits specifically for the default company instance
 */
export const fetchCompanyPermitData = async (): Promise<CompanyPermitData> => {
  const companyId = await getDefaultCompanyId();

  const typesEndpoint = `${API_BASE_URL}/items/permit_types?filter[is_active][_neq]=0&limit=-1&sort=name`;
  
  // Filter permits for this company, plus records with null company_id as fallback
  const permitsEndpoint = companyId
    ? `${API_BASE_URL}/items/permits?filter[_or][0][company_id][_eq]=${companyId}&filter[_or][1][company_id][_null]=true&limit=-1&sort=-id`
    : `${API_BASE_URL}/items/permits?limit=-1&sort=-id`;

  const [typesRes, permitsRes] = await Promise.allSettled([
    fetch(typesEndpoint, { method: "GET", headers: getHeaders(), cache: "no-store" }),
    fetch(permitsEndpoint, { method: "GET", headers: getHeaders(), cache: "no-store" }),
  ]);

  let permitTypes: PermitTypeItem[] = [];
  let rawPermits: Array<Record<string, unknown>> = [];

  if (typesRes.status === "fulfilled" && typesRes.value.ok) {
    const json = await typesRes.value.json();
    permitTypes = json.data || [];
  }

  if (permitsRes.status === "fulfilled" && permitsRes.value.ok) {
    const json = await permitsRes.value.json();
    rawPermits = json.data || [];
  }

  const typeMap = new Map<string, string>();
  const normalizedTypeMap = new Map<string, string>();

  for (const t of permitTypes) {
    const tId = String(t.id);
    const tName = String(t.name || t.permit_type_name || `Permit Type #${t.id}`);
    typeMap.set(tId, tName);
    const norm = normalizeTypeName(tName);
    if (norm) {
      normalizedTypeMap.set(norm, tId);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsedPermits: CompanyPermitRecord[] = [];

  for (const p of rawPermits) {
    const permitTypeId = String(p.permit_type_id || "");
    const rawTypeName = typeMap.get(permitTypeId) || "";
    const expiryStr = (p.expiry_date as string) || (p.expiration_date as string) || "";
    const rawStatus = (p.status as string) || "Active";

    let daysRemaining = 999;
    let healthLevel: PermitHealthLevel = "healthy";

    if (expiryStr) {
      const expDate = parseDateOnly(expiryStr);
      if (expDate) {
        expDate.setHours(0, 0, 0, 0);
        const diffTime = expDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          healthLevel = "critical";
        } else if (daysRemaining <= 90) {
          healthLevel = "warning";
        } else {
          healthLevel = "healthy";
        }
      }
    }

    parsedPermits.push({
      id: (p.id as number | string) || Math.random(),
      company_id: (p.company_id as number | string) || companyId || null,
      permit_type_id: permitTypeId,
      permit_type_name: rawTypeName || `Permit Type #${permitTypeId}`,
      permit_number: String(p.permit_number || "No Permit Number"),
      issue_date: (p.issue_date as string) || (p.issued_date as string) || null,
      expiry_date: expiryStr,
      issued_date: (p.issue_date as string) || (p.issued_date as string) || null,
      expiration_date: expiryStr,
      file_url: (p.file_url as string) || "",
      issuing_agency: (p.issuing_agency as string) || null,
      status: rawStatus,
      notes: (p.notes as string) || (p.remarks as string) || null,
      remarks: (p.notes as string) || (p.remarks as string) || null,
      created_at: (p.created_at as string) || null,
      updated_at: (p.updated_at as string) || null,
      days_remaining: daysRemaining,
      health_level: healthLevel,
    });
  }

  // Group permits by permit_type_id (separate Active vs Archived)
  const activePermitsByType = new Map<string, CompanyPermitRecord[]>();
  const archivedPermitsByType = new Map<string, CompanyPermitRecord[]>();

  for (const p of parsedPermits) {
    const key = String(p.permit_type_id);
    if (p.status === "Archived") {
      if (!archivedPermitsByType.has(key)) archivedPermitsByType.set(key, []);
      archivedPermitsByType.get(key)!.push(p);
    } else {
      if (!activePermitsByType.has(key)) activePermitsByType.set(key, []);
      activePermitsByType.get(key)!.push(p);
    }
  }

  let compliantCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let missingCount = 0;

  const slots: PermitCatalogSlot[] = permitTypes.map((type) => {
    const key = String(type.id);
    const activeList = activePermitsByType.get(key) || [];
    const directArchived = archivedPermitsByType.get(key) || [];

    // Sort active permits: latest expiry date first, then highest ID as tie-breaker
    const sortedActive = [...activeList].sort((a, b) => {
      const expA = parseDateOnly(a.expiry_date || a.expiration_date)?.getTime() || 0;
      const expB = parseDateOnly(b.expiry_date || b.expiration_date)?.getTime() || 0;
      if (expB !== expA) return expB - expA;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    const current = sortedActive[0] || null;
    const superseded = sortedActive.slice(1);

    const history = [...directArchived, ...superseded].sort((a, b) => {
      const dateA = parseDateOnly(a.expiration_date || a.expiry_date)?.getTime() || 0;
      const dateB = parseDateOnly(b.expiration_date || b.expiry_date)?.getTime() || 0;
      return dateB - dateA;
    });

    if (!current) {
      missingCount++;
    } else if (current.health_level === "critical") {
      expiredCount++;
    } else if (current.health_level === "warning") {
      expiringCount++;
    } else {
      compliantCount++;
    }

    return {
      permitType: type,
      currentPermit: current,
      history,
    };
  });

  const totalRequirements = permitTypes.length;
  const complianceRate =
    totalRequirements > 0
      ? Math.round(((compliantCount + expiringCount) / totalRequirements) * 100)
      : 100;

  return {
    summary: {
      totalRequirements,
      compliantCount,
      expiringCount,
      expiredCount,
      missingCount,
      complianceRate,
    },
    slots,
    allPermits: parsedPermits,
    permitTypes,
  };
};

/**
 * Create a new permit record directly in the Company Directus instance
 * Automatically populates company_id using getDefaultCompanyId()
 */
export const createCompanyPermit = async (
  payload: PermitFormData
): Promise<{ success: boolean; data?: CompanyPermitRecord; message?: string }> => {
  const endpoint = `${API_BASE_URL}/items/permits`;

  // Auto-detect Company ID if not explicitly provided
  const companyId = payload.company_id ? Number(payload.company_id) : await getDefaultCompanyId();

  const bodyData: Record<string, unknown> = {
    company_id: companyId,
    permit_type_id: Number(payload.permit_type_id) || payload.permit_type_id,
    permit_number: payload.permit_number.trim(),
    issuing_agency: payload.issuing_agency?.trim() || "Government Agency",
    issue_date: payload.issue_date,
    expiry_date: payload.expiry_date,
    file_url: payload.file_url || "",
    status: payload.status || "Active",
    notes: payload.notes?.trim() || null,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(bodyData),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create permit: ${errText.slice(0, 150)}`);
  }

  const json = await res.json();

  // If renewal, archive the previous permit
  if (payload.renew_from_id) {
    try {
      await updateCompanyPermit(payload.renew_from_id, { status: "Archived" });
    } catch (archiveErr) {
      console.error("Critical: Failed to archive previous permit on renewal:", archiveErr);
    }
  }

  return { success: true, data: json.data };
};

/**
 * Update an existing permit record
 */
export const updateCompanyPermit = async (
  id: number | string,
  payload: Partial<PermitFormData>
): Promise<{ success: boolean; data?: CompanyPermitRecord; message?: string }> => {
  const endpoint = `${API_BASE_URL}/items/permits/${id}`;

  const bodyData: Record<string, unknown> = {};
  if (payload.company_id !== undefined) bodyData.company_id = Number(payload.company_id) || payload.company_id;
  if (payload.permit_number !== undefined) bodyData.permit_number = payload.permit_number.trim();
  if (payload.permit_type_id !== undefined) {
    bodyData.permit_type_id = Number(payload.permit_type_id) || payload.permit_type_id;
  }
  if (payload.issuing_agency !== undefined) bodyData.issuing_agency = payload.issuing_agency?.trim();
  if (payload.issue_date !== undefined) bodyData.issue_date = payload.issue_date;
  if (payload.expiry_date !== undefined) bodyData.expiry_date = payload.expiry_date;
  if (payload.file_url !== undefined) bodyData.file_url = payload.file_url;
  if (payload.status !== undefined) bodyData.status = payload.status;
  if (payload.notes !== undefined) bodyData.notes = payload.notes?.trim() || null;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(bodyData),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update permit: ${errText.slice(0, 150)}`);
  }

  const json = await res.json();
  return { success: true, data: json.data };
};

/**
 * Delete a permit record
 */
export const deleteCompanyPermit = async (
  id: number | string
): Promise<{ success: boolean; message?: string }> => {
  const endpoint = `${API_BASE_URL}/items/permits/${id}`;

  const res = await fetch(endpoint, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete permit: ${errText.slice(0, 150)}`);
  }

  return { success: true, message: "Permit deleted successfully." };
};
