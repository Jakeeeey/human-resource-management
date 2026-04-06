import type {
  Lookups,
  SalesmanDraft,
  SalesmanQrCodeRow,
  SalesmanRow,
} from "../salesman-qr-code/types";

async function http<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
  });

  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      (typeof json === "string" ? json : "") ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

export async function getLookups() {
  return http<{ data: Lookups }>("/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/lookups");
}

export async function listSalesmen() {
  return http<{ data: SalesmanRow[] }>("/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/salesmen");
}

export async function createSalesman(draft: SalesmanDraft) {
  return http<{ data: SalesmanRow }>(`/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/salesmen`, {
    method: "POST",
    body: JSON.stringify({ data: draft }),
  });
}

export async function updateSalesman(id: number, draft: SalesmanDraft) {
  return http<{ data: SalesmanRow }>(`/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/salesmen/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ data: draft }),
  });
}

export async function listSalesmanQrCodes(salesmanId: number) {
  return http<{ data: SalesmanQrCodeRow[] }>(
    `/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/salesmen/${salesmanId}/qr-codes`,
  );
}

/**
 * Upsert by (salesman_id, qr_payment_type_id)
 */
export async function upsertSalesmanQrCode(args: {
  salesmanId: number;
  qr_payment_type_id: number | null;
  file: File;
}) {
  const fd = new FormData();
  fd.append(
    "qr_payment_type_id",
    args.qr_payment_type_id === null ? "" : String(args.qr_payment_type_id),
  );
  fd.append("file", args.file);

  const res = await fetch(
    `/api/hrm/employee-admin/structure/sales-management/salesman-qr-code/salesmen/${args.salesmanId}/qr-codes`,
    {
      method: "POST",
      body: fd,
      credentials: "include",
    },
  );

  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      text ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json as { data: Record<string, unknown> };
}

