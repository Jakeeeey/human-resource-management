"use client";

import * as React from "react";
import type {
  Lookups,
  PriceType,
  SalesmanDraft,
  UserRow,
} from "../../salesman-qr-code/types";
import { fullName, isDeletedUser } from "../../utils/format";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { createSalesman, getLookups } from "../../providers/fetchProvider";

const PRICE_TYPES: PriceType[] = ["A", "B", "C", "D", "E"];

function to01(v: boolean) {
  return v ? 1 : 0;
}

export function SalesmanCreationView() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [lookups, setLookups] = React.useState<Lookups | null>(null);

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
    async function load() {
      setLoading(true);
      try {
        const res = await getLookups();
        setLookups(res.data);
      } catch {
        toast.error("Failed to load metadata.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const employees = React.useMemo(() => {
    return (lookups?.employees ?? []).filter((u) => !isDeletedUser(u));
  }, [lookups]);

  const employee = React.useMemo(() => {
    return employees.find((e) => e.user_id === Number(employeeId ?? -1)) ?? null;
  }, [employees, employeeId]);

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
      inventory_day: null,
    };

    setSaving(true);
    try {
      await createSalesman(draft);
      toast.success("Salesman registered successfully.");
      // Optional: redirect to listing or clear form
      router.push("/hrm/employee-admin/structure/sales-management/salesman-qr-code");
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const employeeLabel = (u: UserRow) => {
    const email = (u.user_email ?? "").trim();
    const nm = fullName(u);
    return email ? `${u.user_id} - ${nm} (${email})` : `${u.user_id} - ${nm}`;
  };

  if (!lookups && loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          <span>Loading metadata...</span>
          </div>
      )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Salesman Registration</CardTitle>
          <CardDescription>Enter the details to register a new salesman in the system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 px-1 overflow-x-hidden">
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
                  {(lookups?.companies ?? []).map((c) => (
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
                  {(lookups?.suppliers ?? []).map((s) => (
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
                  {(lookups?.divisions ?? []).map((d) => (
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
                  {(lookups?.operations ?? []).map((o) => (
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
                  {(lookups?.branches ?? []).map((b) => (
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
                  {(lookups?.branches ?? []).map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-12">
              <div className="rounded-lg border bg-muted/10 p-4 flex flex-wrap items-center justify-start gap-10">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(Boolean(v))} />
                  Active
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={isInventory} onCheckedChange={(v) => setIsInventory(Boolean(v))} />
                  Has Inventory
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={canCollect} onCheckedChange={(v) => setCanCollect(Boolean(v))} />
                  Can Collect
                </label>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-3 border-t bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={() => router.back()} disabled={saving}>
            Back
          </Button>
          <Button onClick={handleSave} disabled={saving} aria-busy={saving} className="gap-2">
            {saving && <Spinner className="h-4 w-4" />}
            <span>{saving ? "Registering..." : "Register Salesman"}</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
