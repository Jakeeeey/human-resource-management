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
} from "../../salesman-qr-code/types";
import { fullName, isDeletedUser } from "../../utils/format";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

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
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{mode === "create" ? "Salesman Registration" : "Edit Salesman"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the required fields to register a new salesman."
              : "Update the salesman details and confirm to save changes."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 max-h-[70vh] overflow-y-auto overflow-x-hidden px-6 py-5">
          {/* Row 1: Employee Link (12) */}
          <div className="md:col-span-12 min-w-0 overflow-hidden">
            <Label>Employee Link</Label>
            <Select
              value={employeeId ? String(employeeId) : ""}
              onValueChange={(v) => setEmployeeId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full truncate">
                <SelectValue placeholder="Select employee" className="truncate" />
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

          <div className="md:col-span-12 -mt-1">
            <p className="text-xs font-medium text-muted-foreground">Salesman Details</p>
          </div>

          {/* Row 2: Salesman Info (6, 3, 3) */}
          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Salesman Name</Label>
            <Input
              value={salesmanName}
              onChange={(e) => setSalesmanName(e.target.value)}
              placeholder="Enter salesman name"
              className="w-full"
            />
          </div>
          <div className="md:col-span-3 min-w-0 overflow-hidden">
            <Label>Salesman Code</Label>
            <Input
              value={salesmanCode}
              onChange={(e) => setSalesmanCode(e.target.value)}
              placeholder="e.g. SM-0001"
              className="w-full"
            />
          </div>

          <div className="md:col-span-3 min-w-0 overflow-hidden">
            <Label>Truck Plate</Label>
            <Input
              value={truckPlate}
              onChange={(e) => setTruckPlate(e.target.value)}
              placeholder="e.g. ABC-1234"
              className="w-full"
            />
          </div>

          {/* Row 3: Price Type & E-mail (4, 8) */}
          <div className="md:col-span-4 min-w-0 overflow-hidden">
            <Label>Price Type</Label>
            <Select value={priceType} onValueChange={(v) => setPriceType(v as PriceType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select price type" className="truncate" />
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

          <div className="md:col-span-8 min-w-0 overflow-hidden">
            <Label>E-mail Address</Label>
            <Input value={(employee?.user_email ?? "").toString()} disabled className="bg-muted/30 w-full" />
          </div>
          <div className="md:col-span-12 py-1">
              <Separator />
          </div>

          <div className="md:col-span-12 -mt-1">
            <p className="text-xs font-medium text-muted-foreground">Contact & Location</p>
          </div>

          {/* Row 4: Contact & Location (6, 6) */}
          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Contact No.</Label>
            <Input value={(employee?.user_contact ?? "").toString()} disabled className="bg-muted/30 w-full" />
          </div>

          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Province</Label>
            <Input value={(employee?.user_province ?? "").toString()} disabled className="bg-muted/30 w-full" />
          </div>

          {/* Row 5: Details (4, 4, 4) */}
          <div className="md:col-span-4 min-w-0 overflow-hidden">
            <Label>City</Label>
            <Input value={(employee?.user_city ?? "").toString()} disabled className="bg-muted/30 w-full" />
          </div>

          <div className="md:col-span-4 min-w-0 overflow-hidden">
            <Label>Barangay</Label>
            <Input value={(employee?.user_brgy ?? "").toString()} disabled className="bg-muted/30 w-full" />
          </div>

          <div className="md:col-span-4 min-w-0 overflow-hidden">
            <Label>Inventory Day</Label>
            <Select value="" onValueChange={() => { }} disabled>
              <SelectTrigger className="opacity-60 bg-muted/30 w-full">
                <SelectValue placeholder="(null)" className="truncate" />
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <div className="md:col-span-12 py-1">
              <Separator />
          </div>

          <div className="md:col-span-12 -mt-1">
            <p className="text-xs font-medium text-muted-foreground">Business</p>
          </div>

          {/* Row 6: Business (6, 6) */}
          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Company</Label>
            <Select
              value={companyCode ? String(companyCode) : ""}
              onValueChange={(v) => setCompanyCode(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select company" className="truncate" />
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

          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Supplier</Label>
            <Select
              value={supplierCode ? String(supplierCode) : ""}
              onValueChange={(v) => setSupplierCode(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select supplier" className="truncate" />
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

          {/* Row 7: Org (6, 6) */}
          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Division</Label>
            <Select
              value={divisionId ? String(divisionId) : ""}
              onValueChange={(v) => setDivisionId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select division" className="truncate" />
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

          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Operation</Label>
            <Select
              value={operationId ? String(operationId) : ""}
              onValueChange={(v) => setOperationId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select operation" className="truncate" />
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

          <div className="md:col-span-12 py-1">
            <Separator />
          </div>

          <div className="md:col-span-12 -mt-1">
            <p className="text-xs font-medium text-muted-foreground">Branching</p>
          </div>

          {/* Row 8: Branching (6, 6) */}
          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Branch</Label>
            <Select
              value={branchId ? String(branchId) : ""}
              onValueChange={(v) => setBranchId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select branch" className="truncate" />
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

          <div className="md:col-span-6 min-w-0 overflow-hidden">
            <Label>Bad Branch</Label>
            <Select
              value={badBranchId ? String(badBranchId) : ""}
              onValueChange={(v) => setBadBranchId(v ? Number(v) : null)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select bad branch" className="truncate" />
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

          <div className="md:col-span-12">
            <div className="rounded-lg border bg-muted/10 p-4 flex flex-wrap items-center justify-start gap-10">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
                Active
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox checked={isInventory} onCheckedChange={(v) => setIsInventory(Boolean(v))} />
                Has Inventory
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox checked={canCollect} onCheckedChange={(v) => setCanCollect(Boolean(v))} />
                Can Collect
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving}
            className="gap-2"
          >
            {saving && <Spinner className="h-4 w-4" />}
            <span>{saving ? "Saving..." : "Confirm"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
