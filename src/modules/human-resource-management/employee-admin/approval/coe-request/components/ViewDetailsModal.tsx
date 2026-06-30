"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Eye, Upload, FileText, ShieldCheck, UserCircle, Paperclip, X } from "lucide-react";
import type { COERequestWithUser } from "../type";
import { COEFilePreviewDialog } from "./COEFilePreviewDialog";
import { uploadCOEFile } from "../providers/fetchProvider";

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: COERequestWithUser | null;
  onApprove: (coeId: number, remarks: string, status?: string, ecopyFileUrl?: string) => Promise<void>;
  onReject: (coeId: number, remarks: string) => Promise<void>;
}

export function ViewDetailsModal({
  isOpen,
  onClose,
  data,
  onApprove,
  onReject,
}: ViewDetailsModalProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!data) return null;

  const fullName = [data.user_fname, data.user_mname, data.user_lname]
    .filter(Boolean)
    .join(" ");

  const formatDate = (date: string) => {
    if (!date) return "N/A";
    return format(new Date(date), "MMM dd, yyyy");
  };

  const statusVariant =
    data.status === "REJECTED" ? "destructive"
    : "secondary";

  const statusClass =
    data.status === "PENDING"
      ? "bg-amber-500 dark:bg-amber-600 text-white hover:bg-amber-500/80 dark:hover:bg-amber-600/80"
      : data.status === "APPROVED"
      ? "bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-600/80 dark:hover:bg-blue-500/80"
      : data.status === "RELEASED"
      ? "bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-600/80 dark:hover:bg-emerald-500/80"
      : "capitalize";

  const handleConfirm = async (action: "APPROVED" | "RELEASED" | "REJECTED") => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      if (action === "RELEASED") {
        if (selectedFile) {
          setUploading(true);
          const uploadResult = await uploadCOEFile(selectedFile);
          await onApprove(data.id, remarks, "RELEASED", uploadResult.file_url);
          setUploading(false);
        } else {
          await onApprove(data.id, remarks, "RELEASED");
        }
      } else if (action === "APPROVED") {
        await onApprove(data.id, remarks);
      } else {
        await onReject(data.id, remarks);
      }
      setRemarks("");
      setSelectedFile(null);
      onClose();
    } catch {
      // error handled upstream
    } finally {
      setIsProcessing(false);
      setUploading(false);
    }
  };

  const handleClose = () => {
    setRemarks("");
    setSelectedFile(null);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/5 via-background to-background border-b px-6 py-4">
            <DialogHeader className="p-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg">COE Request Details</DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Certificate of Employment review
                  </DialogDescription>
                </div>
                <Badge variant={statusVariant as "secondary" | "destructive"} className={`text-xs px-3 py-1 ${statusClass}`}>
                  {data.status.toLowerCase().replace("_", " ")}
                </Badge>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-6">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border">
              <div className="p-3 rounded-full bg-primary/10 shrink-0">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-base truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Requested {formatDate(data.request_date)}
                  {data.approval_date && <> · Processed {formatDate(data.approval_date)}</>}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Purpose</h3>
              <div className="bg-muted/20 border rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                  {data.purpose || "N/A"}
                </p>
              </div>
            </div>

            {data.remarks && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Employee&apos;s Remarks</h3>
                <div className="bg-muted/20 border rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                    {data.remarks}
                  </p>
                </div>
              </div>
            )}

            {data.status === "PENDING" && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-sm">Workflow Actions</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" />
                      Attach E-Copy <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <div
                      className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-background/60 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        {selectedFile ? (
                           <div className="flex items-center gap-2">
                             <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                             <span className="text-xs font-medium truncate">{selectedFile.name}</span>
                             <span className="text-xs text-muted-foreground shrink-0">
                               ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                             </span>
                           </div>
                         ) : (
                          <span className="text-xs text-muted-foreground">Click to attach a PDF file</span>
                        )}
                      </div>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="p-0.5 rounded-full hover:bg-muted transition-colors shrink-0 ml-auto"
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remarks" className="text-xs font-medium">
                      Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="remarks"
                      placeholder="Enter your remarks here..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      disabled={isProcessing}
                      className="bg-background"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleConfirm("REJECTED")}
                      disabled={isProcessing || uploading}
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {isProcessing ? "Processing..." : "Reject"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleConfirm(selectedFile ? "RELEASED" : "APPROVED")}
                      disabled={isProcessing || uploading}
                      size="sm"
                      className={selectedFile ? "bg-emerald-600 hover:bg-emerald-600/90 text-white" : ""}
                    >
                      {isProcessing ? (
                        uploading ? "Uploading..." : "Processing..."
                      ) : selectedFile ? (
                        "Approve & Release"
                      ) : (
                        "Approve"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {data.status === "APPROVED" && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="font-semibold text-sm">Workflow Actions</h3>
                </div>
                <div className="space-y-3">
                  {data.view_file_url ? (
                    <div className="flex items-center justify-between p-3 bg-background/60 border rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {data.ecopy_file_name || "Attached Document"}
                          </p>
                          <p className="text-xs text-muted-foreground">PDF file attached</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="shrink-0">
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Preview
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Paperclip className="h-3 w-3" />
                        Attach E-Copy
                      </Label>
                      <div
                        className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-background/60 transition-colors bg-background/40"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          {selectedFile ? (
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-xs font-medium truncate">{selectedFile.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Click to attach a PDF file</span>
                          )}
                        </div>
                        {selectedFile && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                            className="p-0.5 rounded-full hover:bg-muted transition-colors shrink-0 ml-auto"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="remarks-approved" className="text-xs font-medium">
                      Remarks <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="remarks-approved"
                      placeholder="Enter your remarks here..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      disabled={isProcessing}
                      className="bg-background"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => handleConfirm("RELEASED")}
                      disabled={isProcessing || uploading || (!data.view_file_url && !selectedFile)}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                    >
                      {isProcessing ? (uploading ? "Uploading..." : "Processing...") : "Release"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {data.hr_remarks && data.status !== "PENDING" && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">HR Remarks</h3>
                <div className="bg-muted/20 border rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                    {data.hr_remarks}
                  </p>
                </div>
              </div>
            )}

            {data.status === "RELEASED" && data.view_file_url && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">E-Copy</h3>
                  <div className="flex items-center justify-between p-3 bg-muted/20 border rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {data.ecopy_file_name || "Attached Document"}
                        </p>
                        <p className="text-xs text-muted-foreground">PDF file attached</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="shrink-0">
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <COEFilePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        viewUrl={data.view_file_url}
        fileName={data.ecopy_file_name}
        coeId={data.id}
      />
    </>
  );
}
