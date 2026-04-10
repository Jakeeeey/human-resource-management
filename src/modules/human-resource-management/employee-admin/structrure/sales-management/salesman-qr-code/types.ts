// src/modules/human-resource-management/employee-admin/structrure/sales-management/salesman-qr-code/types.ts

export type PriceType = "A" | "B" | "C" | "D" | "E";
export type SalesmanId = number;

export type SalesmanRow = {
  // ✅ Directus PK. Make it nullable to reflect real API payloads and force guards in UI.
  id: SalesmanId | null;

  employee_id: number | null;
  salesman_code: string | null;
  salesman_name: string | null;
  truck_plate: string | null;

  division_id: number | null;
  branch_code: number | null; // your API uses numbers like 190/191
  bad_branch_code: number | null;
  operation: number | null;

  company_code: number | null;
  supplier_code: number | null;

  price_type: PriceType | string | null;

  // ✅ Directus may return 0/1 as number or null
  isActive: 0 | 1 | number | null;
  isInventory: 0 | 1 | number | null;
  canCollect: 0 | 1 | number | null;

  inventory_day: number | null;

  modified_date: string | null;
  encoder_id: number | null;
};

export type UserRow = {
  user_id: number;
  user_email?: string | null;
  user_fname?: string | null;
  user_mname?: string | null;
  user_lname?: string | null;
  user_contact?: string | null;
  user_province?: string | null;
  user_city?: string | null;
  user_brgy?: string | null;

  // Sometimes these flags come back as Buffer-like objects
  is_deleted?: { type?: string; data?: number[] } | null;
  isDeleted?: unknown;

  // Sometimes the API includes other ids
  external_id?: string | null;
};

export type CompanyRow = {
  company_id: number;
  company_name: string;
  company_code?: string | null;
};

export type SupplierRow = {
  id: number;
  supplier_name: string;
  supplier_shortcut?: string | null;
  supplier_type?: string | null;
  isActive?: 0 | 1 | number | null;
};

export type DivisionRow = {
  division_id: number;
  division_name: string;
};

export type OperationRow = {
  id: number;
  operation_code?: string | null;
  operation_name: string;
  definition?: string | null;
};

export type BranchRow = {
  id: number;
  branch_name: string;
  branch_description?: string | null;
  branch_code?: string | null;
  isActive?: 0 | 1 | number | null;
  isReturn?: 0 | 1 | number | null;
};

export type QrPaymentTypeRow = {
  id: number;
  name: string;
  is_active: 0 | 1 | number;
  sort_order: number;
};

export type SalesmanQrCodeRow = {
  id: number;
  salesman_id: number;
  qr_payment_type_id: number | null;
  link: string;

  created_at?: string;
  created_by?: number | null;
  updated_at?: string | null;
  updated_by?: number | null;
};

export type Lookups = {
  employees: UserRow[];
  companies: CompanyRow[];
  suppliers: SupplierRow[];
  divisions: DivisionRow[];
  operations: OperationRow[];
  branches: BranchRow[];
  qrPaymentTypes: QrPaymentTypeRow[];
};

export type SalesmanDraft = {
  employee_id: number | null;
  salesman_code: string;
  salesman_name: string;
  truck_plate: string;

  division_id: number | null;
  branch_code: number | null;
  bad_branch_code: number | null;
  operation: number | null;

  company_code: number | null;
  supplier_code: number | null;

  price_type: PriceType;

  isActive: 0 | 1;
  isInventory: 0 | 1;
  canCollect: 0 | 1;

  // must be null per your instruction
  inventory_day: null;
};
