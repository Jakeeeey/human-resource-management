"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Printer, Settings2, FileText, Loader2 } from "lucide-react";
import type { ServiceRecordDataResponse } from "../type";
import { generateServiceRecordPdf } from "../utils/serviceRecordPdfGenerator";

interface ServiceRecordPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ServiceRecordDataResponse | null;
}

export function ServiceRecordPdfPreviewModal({
  isOpen,
  onClose,
  data,
}: ServiceRecordPdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showOverrideSettings, setShowOverrideSettings] = useState(false);

  // Signatory overrides for this print job
  const [overridePreparedByName, setOverridePreparedByName] = useState<string | null>(null);
  const [overridePreparedByTitle, setOverridePreparedByTitle] = useState<string | null>(null);
  const [overrideCertifiedByName, setOverrideCertifiedByName] = useState<string | null>(null);
  const [overrideCertifiedByTitle, setOverrideCertifiedByTitle] = useState<string | null>(null);
  const [certDate, setCertDate] = useState(new Date().toISOString().split("T")[0]);
  const [useDittoMarks, setUseDittoMarks] = useState(false);
  const [headerStyle, setHeaderStyle] = useState<"template" | "official">("template");

  const isGenerating = Boolean(isOpen && data && !pdfUrl);

  const preparedByName =
    overridePreparedByName ?? data?.setting?.default_prepared_by_name ?? "MELISSA O. SESIO";
  const preparedByTitle =
    overridePreparedByTitle ?? data?.setting?.default_prepared_by_title ?? "Admin. Officer II";
  const certifiedByName =
    overrideCertifiedByName ?? data?.setting?.default_certified_by_name ?? "JOHN D. ALIDON";
  const certifiedByTitle =
    overrideCertifiedByTitle ?? data?.setting?.default_certified_by_title ?? "Admin. Officer IV/HRMO II";

  useEffect(() => {
    if (!isOpen || !data) return;

    let isCancelled = false;
    let activeUrl: string | null = null;

    generateServiceRecordPdf(data, {
      preparedByName: preparedByName || undefined,
      preparedByTitle: preparedByTitle || undefined,
      certifiedByName: certifiedByName || undefined,
      certifiedByTitle: certifiedByTitle || undefined,
      certificationDate: certDate ? new Date(certDate) : new Date(),
      useDittoMarks,
      headerStyle,
    })
      .then((doc) => {
        if (isCancelled) return;
        const blob = doc.output("blob");
        activeUrl = URL.createObjectURL(blob);
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return activeUrl;
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to generate PDF preview", err);
        }
      });

    return () => {
      isCancelled = true;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [
    isOpen,
    data,
    preparedByName,
    preparedByTitle,
    certifiedByName,
    certifiedByTitle,
    certDate,
    useDittoMarks,
    headerStyle,
  ]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      const doc = await generateServiceRecordPdf(data, {
        preparedByName: preparedByName || undefined,
        preparedByTitle: preparedByTitle || undefined,
        certifiedByName: certifiedByName || undefined,
        certifiedByTitle: certifiedByTitle || undefined,
        certificationDate: certDate ? new Date(certDate) : new Date(),
        useDittoMarks,
        headerStyle,
      });
      const filename = `Service_Record_${data.employee.user_lname}_${data.employee.user_fname}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("Failed to download PDF", err);
    }
  };

  const handlePrint = async () => {
    if (!data) return;
    try {
      const doc = await generateServiceRecordPdf(data, {
        preparedByName: preparedByName || undefined,
        preparedByTitle: preparedByTitle || undefined,
        certifiedByName: certifiedByName || undefined,
        certifiedByTitle: certifiedByTitle || undefined,
        certificationDate: certDate ? new Date(certDate) : new Date(),
        useDittoMarks,
        headerStyle,
      });
      doc.autoPrint();
      const blobUrl = URL.createObjectURL(doc.output("blob"));
      window.open(blobUrl, "_blank");
    } catch (err) {
      console.error("Failed to print PDF", err);
    }
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-5xl md:max-w-6xl p-0 flex flex-col gap-0 border border-border/50 shadow-2xl overflow-hidden rounded-2xl h-[92vh] bg-background">
        {/* Header toolbar */}
        <DialogHeader className="px-6 py-4 flex-row items-center justify-between space-y-0 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                Service Record PDF Preview
                <span className="text-xs font-mono font-semibold text-primary">
                  ({data.employee.user_lname}, {data.employee.user_fname})
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Official Civil Service Commission (CSC / EO 54) Standard Format
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 mr-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOverrideSettings(!showOverrideSettings)}
              className="h-9 rounded-xl text-xs font-bold gap-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Signatories
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 rounded-xl text-xs font-bold gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-primary" />
              Print
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-md shadow-primary/20"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Optional Signatories Override Drawer */}
        {showOverrideSettings && (
          <div className="p-4 bg-muted/40 border-b border-border/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Prepared By (Name)</Label>
              <Input
                value={preparedByName}
                onChange={(e) => setOverridePreparedByName(e.target.value)}
                className="h-7 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Prepared By (Title)</Label>
              <Input
                value={preparedByTitle}
                onChange={(e) => setOverridePreparedByTitle(e.target.value)}
                className="h-7 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Certified Correct (Name)</Label>
              <Input
                value={certifiedByName}
                onChange={(e) => setOverrideCertifiedByName(e.target.value)}
                className="h-7 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Certified Correct (Title)</Label>
              <Input
                value={certifiedByTitle}
                onChange={(e) => setOverrideCertifiedByTitle(e.target.value)}
                className="h-7 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase">Certification Date</Label>
              <Input
                type="date"
                value={certDate}
                onChange={(e) => setCertDate(e.target.value)}
                className="h-7 text-xs rounded-lg"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 md:col-span-2">
              <Label className="text-[10px] font-bold uppercase">Header Style</Label>
              <select
                value={headerStyle}
                onChange={(e) => setHeaderStyle(e.target.value as "template" | "official")}
                className="h-7 w-full rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="template">Saved PDF Template (Company / LGU Branding)</option>
                <option value="official">Official Government Letterhead (Republic of the Philippines)</option>
              </select>
            </div>
            <div className="col-span-full pt-1 flex items-center gap-2">
              <input
                type="checkbox"
                id="ditto"
                checked={useDittoMarks}
                onChange={(e) => setUseDittoMarks(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary cursor-pointer"
              />
              <Label htmlFor="ditto" className="text-xs font-semibold cursor-pointer text-muted-foreground hover:text-foreground">
                Display ditto marks (&quot;-do-&quot;) for repeated stations and branches
              </Label>
            </div>
          </div>
        )}

        {/* Preview Frame */}
        <div className="flex-1 bg-muted/20 relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-bold text-muted-foreground">Rendering PDF document...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              title="Service Record PDF Preview"
              className="w-full h-full border-none"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
              Unable to generate preview.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
