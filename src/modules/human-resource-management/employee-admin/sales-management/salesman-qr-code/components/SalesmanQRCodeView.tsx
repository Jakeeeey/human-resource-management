"use client";

import * as React from "react";
import type { Lookups, SalesmanRow } from "../types";

import { SalesmanQrDialog } from "./SalesmanQrDialog";
import { SalesmanFormDialog } from "../../salesman-creation/components/SalesmanFormDialog";

// Provider functions (rename if your file exports different names)
import { listSalesmen, getLookups, createSalesman, updateSalesman } from "../../providers/fetchProvider";
import type { SalesmanDraft } from "../types";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCcw, QrCode, UserPlus, Edit2 } from "lucide-react";

function safeId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function textIncludes(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function SalesmanQRCodeView() {
  const [loading, setLoading] = React.useState(false);
  const [salesmen, setSalesmen] = React.useState<SalesmanRow[]>([]);
  const [lookups, setLookups] = React.useState<Lookups | null>(null);
  const [q, setQ] = React.useState("");
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrSalesman, setQrSalesman] = React.useState<SalesmanRow | null>(null);

  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<"create" | "edit">("create");
  const [formInitial, setFormInitial] = React.useState<SalesmanRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([listSalesmen(), getLookups()]);
      setSalesmen(s?.data ?? []);
      setLookups(l?.data ?? null);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to load salesman data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openQr = (row: SalesmanRow) => {
    setQrSalesman(row);
    setQrOpen(true);
  };

  const openCreate = () => {
    setFormMode("create");
    setFormInitial(null);
    setFormOpen(true);
  };

  const openEdit = (row: SalesmanRow) => {
    setFormMode("edit");
    setFormInitial(row);
    setFormOpen(true);
  };

  const handleFormSubmit = async (draft: SalesmanDraft) => {
    if (formMode === "edit" && formInitial?.id) {
      await updateSalesman(formInitial.id, draft);
      toast.success("Salesman updated successfully.");
    } else {
      await createSalesman(draft);
      toast.success("Salesman registered successfully.");
    }
    void load();
  };

  const filtered = React.useMemo(() => {
    const needle = q.trim();
    if (!needle) return salesmen;

    return salesmen.filter((r) => {
      const parts = [
        r.salesman_code ?? "",
        r.salesman_name ?? "",
        r.truck_plate ?? "",
        String(r.id ?? ""),
        String(r.employee_id ?? ""),
      ];
      return parts.some((p) => textIncludes(p, needle));
    });
  }, [salesmen, q]);

  const divisionName = React.useCallback(
    (divisionId: number | null) => {
      if (!lookups?.divisions || !divisionId) return "—";
      return lookups.divisions.find((d) => d.division_id === divisionId)?.division_name ?? "—";
    },
    [lookups?.divisions],
  );

  const operationName = React.useCallback(
    (opId: number | null) => {
      if (!lookups?.operations || !opId) return "—";
      return lookups.operations.find((o) => o.id === opId)?.operation_name ?? "—";
    },
    [lookups?.operations],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search salesman..."
            className="w-full sm:w-80"
          />
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCcw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="cursor-pointer">
            <UserPlus className="mr-2 h-4 w-4" />
            Register Salesman
          </Button>
          <Badge variant="secondary">{filtered.length} rows</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">ID</TableHead>
                <TableHead>Salesman</TableHead>
                <TableHead className="hidden md:table-cell">Code</TableHead>
                <TableHead className="hidden lg:table-cell">Division</TableHead>
                <TableHead className="hidden lg:table-cell">Operation</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {loading ? "Loading..." : "No results."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const id = safeId(row.id);

                  return (
                    <TableRow key={id ?? `${row.salesman_code ?? "row"}-${Math.random()}`}>
                      <TableCell className="font-mono text-xs">{id ?? "—"}</TableCell>

                      <TableCell>
                        <div className="font-medium">{row.salesman_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          Truck: {row.truck_plate ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell">
                        {row.salesman_code ?? "—"}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        {divisionName(row.division_id)}
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        {operationName(row.operation)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => openEdit(row)}
                            disabled={!id}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => openQr(row)}
                            disabled={!id}
                            title={!id ? "Missing salesman id" : "Set QR Code"}
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            QR
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <SalesmanQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        salesman={qrSalesman}
        qrTypes={lookups?.qrPaymentTypes ?? []}
        onSaved={() => void load()}
      />
      <SalesmanFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lookups={lookups ?? { employees: [], companies: [], suppliers: [], divisions: [], operations: [], branches: [], qrPaymentTypes: [] }}
        mode={formMode}
        initial={formInitial}
        onSubmit={handleFormSubmit}
      />
    </div>
  );
}

export default SalesmanQRCodeView;
