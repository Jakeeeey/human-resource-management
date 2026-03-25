"use client";

/**
 * MasterlistPreviewModal
 * Opens a print-preview dialog for the Employee Masterlist Summary PDF.
 * Uses jsPDF to render the report in-browser (blob URL → iframe).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Printer } from "lucide-react";
import type { User, Department } from "../types";
import { generateMasterlistPdf } from "../utils/masterlistPdfService";

interface MasterlistPreviewModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employees: User[];
  departments: Department[];
  companyName?: string;
}

export function MasterlistPreviewModal({
  isOpen,
  onOpenChange,
  employees,
  departments,
  companyName = "Human Resource Management",
}: MasterlistPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const blobRef = useRef<string | null>(null);

  // Clean up previous blob URL to prevent memory leaks
  const clearBlob = useCallback(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  // Generate PDF when modal opens
  useEffect(() => {
    if (!isOpen) { clearBlob(); return; }

    let cancelled = false;
    setIsGenerating(true);
    clearBlob();

    generateMasterlistPdf({ employees, departments, companyName })
      .then((doc) => {
        if (cancelled) return;
        const blob = doc.output("blob");
        const url  = URL.createObjectURL(blob);
        blobRef.current = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        console.error("PDF generation failed:", err);
      })
      .finally(() => {
        if (!cancelled) setIsGenerating(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Download handler ──────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const doc = await generateMasterlistPdf({ employees, departments, companyName });
    const dateStr = new Date().toISOString().slice(0, 10);
    doc.save(`Employee_Masterlist_Summary_${dateStr}.pdf`);
  }, [employees, departments, companyName]);

  // ── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    if (!blobUrl) return;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = blobUrl;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    };
  }, [blobUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[98vw] sm:max-w-none w-[98vw] h-[96vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl border-none"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <DialogHeader className="flex-none px-6 py-4 border-b bg-gradient-to-r from-primary to-primary/80">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-white text-lg font-bold tracking-tight">
                Masterlist Summary — Print Preview
              </DialogTitle>
              <p className="text-primary-foreground/70 text-xs mt-0.5">
                Landscape Legal · {employees.length} employee{employees.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 pr-8">
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePrint}
                disabled={!blobUrl || isGenerating}
                className="h-8 rounded-lg gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={handleDownload}
                disabled={isGenerating}
                className="h-8 rounded-lg gap-1.5 text-xs bg-white text-primary hover:bg-white/90"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ── Preview area ──────────────────────────────────────────────── */}
        <div className="flex-1 bg-muted/30 overflow-hidden relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Generating PDF preview…
              </p>
            </div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title="Masterlist PDF Preview"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Preview unavailable. Try downloading directly.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
