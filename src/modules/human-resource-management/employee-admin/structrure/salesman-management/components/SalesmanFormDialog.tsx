"use client";

import * as React from "react";
import type {
  BranchRow,
  CompanyRow,
  DivisionRow,
  Lookups,
  OperationRow,
  PriceType,
  SalesmanDraft,
  SalesmanRow,
  SupplierRow,
  UserRow,
} from "../types";
import { fullName, isDeletedUser } from "../utils/format";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRICE_TYPES: PriceType[] = ["A", "B", "C", "D", "E"];

function to01(v: boolean) {
  return v ? 1 : 0;
}

function toBool(v: 0 | 1 | number | null | undefined) {
  return Number(v ?? 0) === 1;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  lookups: Lookups;

  mode: "create" | "edit";
  initial?: SalesmanRow | null;

  onSubmit: (draft: SalesmanDraft) => Promise<void>;
};

export function SalesmanFormDialog(props: Props) {
  const { open, onOpenChange, lookups, mode, initial } = props;

  const employees = React.useMemo(() => {
    return (lookups.employees ?? []).filter((u) => !isDeletedUser(u));
  }, [lookups.employees]);

  const getEmployee = React.useCallback(
    (id: number | null) => employees.find((e) => e.user_id === Number(id ?? -1)) ?? null,
    [employees],
  );

  const [saving, setSaving] = React.useState(false);

  const [employeeId, setEmployeeId] = React.useState<number | null>(null);
  const [salesmanName, setSalesmanName] = React.useState("");
  const [salesmanCode, setSalesmanCode] = React.useState("");
  const [truckPlate, setTruckPlate] = React.useState("");

  const [companyCode, setCompanyCode] = React.useState<number | null>(null);
  const [supplierCode, setSupplierCode] = React.useState<number | null>(null);
  const [divisionId, setDivisionId] = React.useState<number | null>(null);
  const [operationId, setOperationId] = React.useState<number | null>(null);

  const [branchId, setBranchId] = React.useState<number | null>(null);
  const [badBranchId, setBadBranchId] = React.useState<number | null>(null);

  const [priceType, setPriceType] = React.useState<PriceType>("A");

  const [isActive, setIsActive] = React.useState(true);
  const [isInventory, setIsInventory] = React.useState(false);
  const [canCollect, setCanCollect] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initial) {
      setEmployeeId(initial.employee_id ?? null);
      setSalesmanName((initial.salesman_name ?? "").trim());
      setSalesmanCode((initial.salesman_code ?? "").trim());
      setTruckPlate((initial.truck_plate ?? "").trim());

      setCompanyCode(initial.company_code ?? null);
      setSupplierCode(initial.supplier_code ?? null);
      setDivisionId(initial.division_id ?? null);
      setOperationId(initial.operation ?? null);

      setBranchId(initial.branch_code ?? null);
      setBadBranchId(initial.bad_branch_code ?? null);

      setPriceType((initial.price_type as PriceType) ?? "A");

      setIsActive(toBool(initial.isActive));
      setIsInventory(toBool(initial.isInventory));
      setCanCollect(toBool(initial.canCollect));
    } else {
      setEmployeeId(null);
      setSalesmanName("");
      setSalesmanCode("");
      setTruckPlate("");

      setCompanyCode(null);
      setSupplierCode(null);
      setDivisionId(null);
      setOperationId(null);

      setBranchId(null);
      setBadBranchId(null);

      setPriceType("A");

      setIsActive(true);
      setIsInventory(false);
      setCanCollect(false);
    }
  }, [open, mode, initial]);

  const employee = React.useMemo(() => getEmployee(employeeId), [getEmployee, employeeId]);

  const companies: CompanyRow[] = lookups.companies ?? [];
  const suppliers: SupplierRow[] = lookups.suppliers ?? [];
  const divisions: DivisionRow[] = lookups.divisions ?? [];
  const operations: OperationRow[] = lookups.operations ?? [];
  const branches: BranchRow[] = lookups.branches ?? [];

  const handleSave = async () => {
    const name = salesmanName.trim();
    const code = salesmanCode.trim();
    const plate = truckPlate.trim();

    if (!employeeId) return toast.error("Employee Link is required.");
    if (!name) return toast.error("Salesman Name is required.");
    if (!code) return toast.error("Salesman Code is required.");
    if (!plate) return toast.error("Truck Plate is required.");

    const draft: SalesmanDraft = {
      employee_id: employeeId,
      salesman_name: name,
      salesman_code: code,
      truck_plate: plate,

      company_code: companyCode,
      supplier_code: supplierCode,
      division_id: divisionId,
      operation: operationId,

      branch_code: branchId,
      bad_branch_code: badBranchId,

      price_type: priceType,

      isActive: to01(isActive),
      isInventory: to01(isInventory),
      canCollect: to01(canCollect),

      // per your instruction:
      inventory_day: null,
    };

    setSaving(true);
    try {
      await props.onSubmit(draft);
      onOpenChange(false);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to save salesman.");
    } finally {
      setSaving(false);
    }
  };

  const employeeLabel = (u: UserRow) => {
    const email = (u.user_email ?? "").trim();
    const nm = fullName(u);
    return email ? `${u.user_id} - ${nm} (${email})` : `${u.user_id} - ${nm}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Salesman Registration" : "Edit Salesman"}</DialogTitle>
        </DialogHeader>

        {/* Top filters style row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-4">
            <Label>Employee Link</Label>
            <Select
              value={employeeId ? String(employeeId) : ""}
              onValueChange={(v) => setEmployeeId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {employees.map((u) => (
                  <SelectItem key={u.user_id} value={String(u.user_id)}>
                    {employeeLabel(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4">
            <Label>Salesman Name</Label>
            <Input value={salesmanName} onChange={(e) => setSalesmanName(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label>Salesman Code</Label>
            <Input value={salesmanCode} onChange={(e) => setSalesmanCode(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <Label>Truck Plate</Label>
            <Input value={truckPlate} onChange={(e) => setTruckPlate(e.target.value)} />
          </div>

          {/* Read-only employee info (matches your UI fields) */}
          <div className="md:col-span-4">
            <Label>E-mail Address</Label>
            <Input value={(employee?.user_email ?? "").toString()} disabled />
          </div>

          <div className="md:col-span-3">
            <Label>Contact No.</Label>
            <Input value={(employee?.user_contact ?? "").toString()} disabled />
          </div>

          <div className="md:col-span-2">
            <Label>Province</Label>
            <Input value={(employee?.user_province ?? "").toString()} disabled />
          </div>

          <div className="md:col-span-2">
            <Label>City</Label>
            <Input value={(employee?.user_city ?? "").toString()} disabled />
          </div>

          <div className="md:col-span-1">
            <Label>Barangay</Label>
            <Input value={(employee?.user_brgy ?? "").toString()} disabled />
          </div>

          {/* Lookups */}
          <div className="md:col-span-3">
            <Label>Company</Label>
            <Select
              value={companyCode ? String(companyCode) : ""}
              onValueChange={(v) => setCompanyCode(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {companies.map((c) => (
                  <SelectItem key={c.company_id} value={String(c.company_id)}>
                    {c.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Supplier</Label>
            <Select
              value={supplierCode ? String(supplierCode) : ""}
              onValueChange={(v) => setSupplierCode(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Division</Label>
            <Select
              value={divisionId ? String(divisionId) : ""}
              onValueChange={(v) => setDivisionId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {divisions.map((d) => (
                  <SelectItem key={d.division_id} value={String(d.division_id)}>
                    {d.division_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Operation</Label>
            <Select
              value={operationId ? String(operationId) : ""}
              onValueChange={(v) => setOperationId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {operations.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.operation_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Inventory Day</Label>
            {/* must be null -> keep UI but disable */}
            <Select value="" onValueChange={() => { }} disabled>
              <SelectTrigger className="opacity-60">
                <SelectValue placeholder="(null)" />
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Branch</Label>
            <Select
              value={branchId ? String(branchId) : ""}
              onValueChange={(v) => setBranchId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Bad Branch</Label>
            <Select
              value={badBranchId ? String(badBranchId) : ""}
              onValueChange={(v) => setBadBranchId(v ? Number(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select bad branch" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Price Type</Label>
            <Select value={priceType} onValueChange={(v) => setPriceType(v as PriceType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select price type" />
              </SelectTrigger>
              <SelectContent>
                {PRICE_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-9 flex items-start justify-end gap-6 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
              Active
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isInventory} onCheckedChange={(v) => setIsInventory(Boolean(v))} />
              Has Inventory
            </label>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={canCollect} onCheckedChange={(v) => setCanCollect(Boolean(v))} />
              Can Collect
            </label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
