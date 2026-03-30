"use client";

import * as React from "react";
import type { QrPaymentTypeRow, SalesmanQrCodeRow, SalesmanRow } from "../types";
import { listSalesmanQrCodes, upsertSalesmanQrCode } from "../../providers/fetchProvider";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  salesman: SalesmanRow | null;
  qrTypes: QrPaymentTypeRow[];

  onSaved?: () => void;
};

const NULL_TYPE = "__NULL__";

function asId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SalesmanQrDialog(props: Props) {
  const { open, onOpenChange, salesman, qrTypes } = props;

  // ✅ ALWAYS use salesman.id (Directus PK)
  const salesmanId = asId(salesman?.id);

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [rows, setRows] = React.useState<SalesmanQrCodeRow[]>([]);
  const [qrTypeId, setQrTypeId] = React.useState<number | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!salesmanId) return;
    setLoading(true);
    try {
      const r = await listSalesmanQrCodes(salesmanId);
      setRows(r.data ?? []);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to load QR codes.");
    } finally {
      setLoading(false);
    }
  }, [salesmanId]);

  React.useEffect(() => {
    if (!open) return;

    setQrTypeId(qrTypes?.[0]?.id ?? null);
    setFile(null);
    setPreviewUrl(null);
    setRows([]);

    if (!salesmanId) {
      toast.error("Salesman ID is missing. Please refresh the list and try again.");
      return;
    }

    void load();
  }, [open, qrTypes, salesmanId, load]);

  const current = React.useMemo(() => {
    if (!salesmanId) return null;
    return (
      rows.find((x) => {
        const a = x.qr_payment_type_id == null ? null : Number(x.qr_payment_type_id);
        const b = qrTypeId == null ? null : Number(qrTypeId);
        return Number(x.salesman_id) === salesmanId && a === b;
      }) ?? null
    );
  }, [rows, salesmanId, qrTypeId]);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const typeName = (id: number | null) =>
    qrTypes.find((t) => t.id === id)?.name ?? "—";

  const handleSave = async () => {
    if (!salesmanId) return toast.error("Salesman ID is missing.");
    if (!file) return toast.error("Please upload a QR image/file.");

    setSaving(true);
    try {
      await upsertSalesmanQrCode({
        salesmanId, // ✅ always a number now
        qr_payment_type_id: qrTypeId,
        file,
      });

      toast.success("QR code uploaded & saved.");
      setFile(null);
      setPreviewUrl(null);

      await load();
      props.onSaved?.();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message ?? "Failed to upload QR code.");
    } finally {
      setSaving(false);
    }
  };

  const savedLink = current?.link || null;
  const isImage = savedLink ? /\.(png|jpg|jpeg|webp|gif)$/i.test(savedLink) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Salesman QR Code</DialogTitle>
          <DialogDescription>
            Upload a QR image/file for the selected payment type.
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          {salesman ? (
            <>
              <div className="font-medium text-foreground">
                {salesman.salesman_name ?? "—"}
              </div>
              <div>{salesman.salesman_code ?? "—"}</div>
              <div className="text-xs">Salesman ID: {salesmanId ?? "—"}</div>
            </>
          ) : (
            "—"
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>QR Type</Label>
            <Select
              value={qrTypeId === null ? NULL_TYPE : String(qrTypeId)}
              onValueChange={(v) => setQrTypeId(v === NULL_TYPE ? null : Number(v))}
              disabled={!qrTypes?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NULL_TYPE}>No Type</SelectItem>
                {qrTypes.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Upload QR Image / File</Label>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="mt-1 text-xs text-muted-foreground">
              Selected: {file ? file.name : "—"}
            </div>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-xs text-muted-foreground">
            Current ({typeName(qrTypeId)}) {loading ? "(loading...)" : ""}
          </div>

          {savedLink ? (
            <div className="space-y-2">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={savedLink}
                  alt="Saved QR"
                  className="max-h-56 rounded-md border object-contain"
                />
              ) : (
                <a className="text-sm underline" href={savedLink} target="_blank" rel="noreferrer">
                  Open saved file
                </a>
              )}
              <div className="break-all text-xs text-muted-foreground">{savedLink}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No QR uploaded for this type yet.
            </div>
          )}

          {previewUrl ? (
            <div className="mt-4">
              <div className="text-xs text-muted-foreground">New Upload Preview</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Preview"
                className="mt-2 max-h-56 rounded-md border object-contain"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>
              Close
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={saving || !salesmanId}>
            {saving ? "Uploading..." : "Upload & Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
