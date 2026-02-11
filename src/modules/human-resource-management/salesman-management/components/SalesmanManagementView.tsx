"use client";

import * as React from "react";
import type { Lookups, SalesmanRow } from "../types";

import { SalesmanQrDialog } from "./SalesmanQrDialog";

// Provider functions (rename if your file exports different names)
import { listSalesmen, getLookups } from "../providers/fetchProvider";

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
import { RefreshCcw, QrCode } from "lucide-react";

function safeId(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function textIncludes(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export function SalesmanManagementView() {
  const [loading, setLoading] = React.useState(false);

  // ✅ This must be the raw rows from Directus. Do not map away `id`.
  const [salesmen, setSalesmen] = React.useState<SalesmanRow[]>([]);

  const [lookups, setLookups] = React.useState<Lookups | null>(null);

  // simple search
  const [q, setQ] = React.useState("");

  // QR dialog state
  const [qrOpen, setQrOpen] = React.useState(false);
  const [qrSalesman, setQrSalesman] = React.useState<SalesmanRow | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([listSalesmen(), getLookups()]);

      // ✅ IMPORTANT: store rows as-is (do not transform)
      setSalesmen(s?.data ?? []);
      setLookups(l?.data ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load salesman data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // ✅ This is the ONLY place that opens the QR dialog.
  // It passes the EXACT row from the table (raw Directus row).
  const openQr = (row: SalesmanRow) => {
    const id = safeId(row?.id);
    if (!id) {
      toast.error("Salesman ID is missing. Please refresh the list.");
      return;
    }
    setQrSalesman(row);
    setQrOpen(true);
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
      {/* Header actions */}
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

        {/* Add/Edit buttons can stay here (not included since you asked QR pass fix only) */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{filtered.length} rows</Badge>
        </div>
      </div>

      {/* Table */}
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
                          {/* ✅ QR button passes the RAW row */}
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

                          {/* Add your Edit button here if you have it */}
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

      {/* ✅ QR Dialog receives the exact row from Directus */}
      <SalesmanQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        salesman={qrSalesman}
        qrTypes={lookups?.qrPaymentTypes ?? []}
        onSaved={() => void load()}
      />
    </div>
  );
}

export default SalesmanManagementView;
