"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, X, FileText } from "lucide-react";

interface COEFilePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewUrl: string | null;
  fileName: string | null;
  coeId: number;
}

export function COEFilePreviewDialog({
  open,
  onOpenChange,
  viewUrl,
  fileName,
  coeId,
}: COEFilePreviewProps) {
  const downloadUrl = viewUrl ? `${viewUrl}?download=1` : null;
  const displayName = fileName || `COE-${coeId}.pdf`;

  const handleDownload = async () => {
    if (!downloadUrl) return;
    try {
      const res = await fetch(downloadUrl);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = displayName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[COE download] failed", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[900px] overflow-hidden p-0 rounded-2xl border-2 shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="bg-gradient-to-r from-primary/10 via-background to-primary/5 p-5 pb-3">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
                <FileText className="h-5 w-5 text-primary stroke-[2.5px]" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg font-bold tracking-tight line-clamp-1">
                  {displayName}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium opacity-70">
                  PDF Document · COE #{coeId}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <Separator className="bg-primary/10" />

        <div className="p-5">
          <div className="rounded-xl border bg-muted/20 overflow-hidden h-[60vh]">
            {viewUrl && (
              <iframe
                src={viewUrl}
                title={displayName}
                className="w-full h-full border-0"
              />
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-0 flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!downloadUrl}
            className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:flex-1 h-11 rounded-xl font-bold text-muted-foreground hover:bg-muted"
          >
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
