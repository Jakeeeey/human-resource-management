"use client";

import React, { useState, } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Pencil,
  FilePlus,
  FileText,
  Calendar,
  Hash,
  Landmark,
  AlertCircle,
} from "lucide-react";
import { PermitFileUpload } from "./PermitFileUpload";
import { toast } from "sonner";
import {
  PermitTypeItem,
  PermitFormData,
  CompanyPermitRecord,
} from "../types/permit.types";

interface CompanyPermitFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PermitFormData, file?: File | null) => Promise<boolean>;
  isSubmitting: boolean;
  permitTypes: PermitTypeItem[];
  initialPermitType?: PermitTypeItem | null;
  editRecord?: CompanyPermitRecord | null;
  isRenewalMode?: boolean;
}

export const CompanyPermitFormDialog: React.FC<CompanyPermitFormDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  permitTypes,
  initialPermitType,
  editRecord,
  isRenewalMode = false,
}) => {
  const [formData, setFormData] = useState<PermitFormData>({
    permit_type_id: "",
    permit_number: "",
    issue_date: "",
    expiry_date: "",
    file_url: "",
    issuing_agency: "",
    status: "Active",
    notes: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

    const [prevFormKey, setPrevFormKey] = useState("");
  const currentFormKey = `${isOpen ? "open" : "closed"}_${isRenewalMode ? "renew" : "edit"}_${editRecord?.id || "new"}_${initialPermitType?.id || ""}`;

  if (currentFormKey !== prevFormKey) {
    setPrevFormKey(currentFormKey);
    if (isOpen) {
      setSelectedFile(null);
      setErrors({});
      if (editRecord) {
        if (isRenewalMode) {
          setFormData({
            id: undefined,
            permit_type_id: String(editRecord.permit_type_id),
            permit_number: editRecord.permit_number || "",
            issue_date: new Date().toISOString().substring(0, 10),
            expiry_date: "",
            file_url: "",
            issuing_agency: editRecord.issuing_agency || "",
            status: "Active",
            notes: `Renewed from permit #${editRecord.permit_number}`,
            renew_from_id: editRecord.id,
          });
        } else {
          setFormData({
            id: editRecord.id,
            permit_type_id: String(editRecord.permit_type_id),
            permit_number: editRecord.permit_number || "",
            issue_date: editRecord.issue_date || editRecord.issued_date || "",
            expiry_date: editRecord.expiry_date || editRecord.expiration_date || "",
            file_url: editRecord.file_url || "",
            issuing_agency: editRecord.issuing_agency || "",
            status: editRecord.status || "Active",
            notes: editRecord.notes || editRecord.remarks || "",
          });
        }
      } else {
        setFormData({
          permit_type_id: initialPermitType ? String(initialPermitType.id) : "",
          permit_number: "",
          issue_date: new Date().toISOString().substring(0, 10),
          expiry_date: "",
          file_url: "",
          issuing_agency: "",
          status: "Active",
          notes: "",
        });
      }
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.permit_type_id) {
      newErrors.permit_type_id = "Please select a permit requirement / type";
    }

    if (!formData.permit_number.trim()) {
      newErrors.permit_number = "Permit or registration number is required";
    }

    if (!formData.issue_date) {
      newErrors.issue_date = "Date issued is required";
    }

    if (!formData.expiry_date) {
      newErrors.expiry_date = "Expiration date is required";
    } else if (formData.issue_date && formData.expiry_date <= formData.issue_date) {
      newErrors.expiry_date = "Expiration date must be later than the issue date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fill in all required fields properly");
      return;
    }

    let finalFileUrl = formData.file_url;

    // Handle File Upload if selected
    if (selectedFile) {
      const uploadForm = new FormData();
      uploadForm.append("file", selectedFile);
      try {
        const res = await fetch("/api/hrm/permit/upload", {
          method: "POST",
          body: uploadForm,
        });
        const uploadResult = await res.json();
        if (uploadResult.success) {
          finalFileUrl = uploadResult.file_id || uploadResult.data?.id || uploadResult.file_url || finalFileUrl;
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    const payload: PermitFormData = {
      ...formData,
      file_url: finalFileUrl,
    };

    const success = await onSubmit(payload);
    if (success) {
      onClose();
    }
  };

  const selectedPermitTypeName =
    permitTypes.find((t) => String(t.id) === String(formData.permit_type_id))?.name ||
    permitTypes.find((t) => String(t.id) === String(formData.permit_type_id))?.permit_type_name ||
    "Select permit requirement";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden border-border bg-card">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <DialogHeader className="p-5 pb-4 border-b border-border/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 ${
                  isRenewalMode
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : editRecord
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isRenewalMode ? (
                  <RefreshCw className="h-5 w-5" />
                ) : editRecord ? (
                  <Pencil className="h-5 w-5" />
                ) : (
                  <FilePlus className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {isRenewalMode
                    ? "Renew Permit Certificate"
                    : editRecord
                    ? "Edit Permit Record"
                    : "Upload New Permit"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {isRenewalMode
                    ? "Upload renewed certificate and update expiration dates. Previous permit will be kept in renewal history."
                    : "Fill in the certificate details and attach the official scanned file"}
                </DialogDescription>
              </div>
            </div>

            {isRenewalMode && editRecord && (
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>Renewing: <strong>{selectedPermitTypeName}</strong></span>
                <Badge variant="outline" className="text-[10px] bg-emerald-100/60 dark:bg-emerald-900/60 border-emerald-300">
                  #{editRecord.permit_number}
                </Badge>
              </div>
            )}
          </DialogHeader>

          {/* Form Body */}
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* 1. Permit Requirement / Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Permit Requirement / Type</span>
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(formData.permit_type_id)}
                onValueChange={(val) => {
                  setFormData((prev) => ({ ...prev, permit_type_id: val }));
                  if (errors.permit_type_id) {
                    setErrors((prev) => {
                      const updated = { ...prev };
                      delete updated.permit_type_id;
                      return updated;
                    });
                  }
                }}
                disabled={isRenewalMode}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border/80">
                  <SelectValue placeholder="Select permit requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {permitTypes.map((type) => (
                    <SelectItem key={String(type.id)} value={String(type.id)} className="text-xs">
                      {type.name || type.permit_type_name || `Permit Type #${type.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.permit_type_id && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{errors.permit_type_id}</span>
                </p>
              )}
            </div>

            {/* 2. Permit Number & Issuing Agency Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                  <span>Permit / Registration No.</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. BP-2026-0001"
                  value={formData.permit_number}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, permit_number: e.target.value }));
                    if (errors.permit_number) {
                      setErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.permit_number;
                        return updated;
                      });
                    }
                  }}
                  className="h-9 text-xs rounded-xl bg-background border-border/80 font-mono"
                />
                {errors.permit_number && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.permit_number}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Landmark className="h-3.5 w-3.5 text-primary" />
                  <span>Issuing Agency</span>
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. City Government / BIR / BFP"
                  value={formData.issuing_agency || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, issuing_agency: e.target.value }))}
                  className="h-9 text-xs rounded-xl bg-background border-border/80"
                />
              </div>
            </div>

            {/* 3. Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Date Issued</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, issue_date: e.target.value }));
                    if (errors.issue_date) {
                      setErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.issue_date;
                        return updated;
                      });
                    }
                  }}
                  className="h-9 text-xs rounded-xl bg-background border-border/80"
                />
                {errors.issue_date && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.issue_date}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>Expiration Date</span>
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, expiry_date: e.target.value }));
                    if (errors.expiry_date) {
                      setErrors((prev) => {
                        const updated = { ...prev };
                        delete updated.expiry_date;
                        return updated;
                      });
                    }
                  }}
                  className="h-9 text-xs rounded-xl bg-background border-border/80"
                />
                {errors.expiry_date && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.expiry_date}</span>
                  </p>
                )}
              </div>
            </div>

            {/* 4. Permit Certificate File Upload (Matching Holdings drag & drop) */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Permit Certificate File (PDF / Image)</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional / Max 10MB</span>
              </Label>
              <PermitFileUpload
                value={formData.file_url}
                selectedFile={selectedFile}
                onFileSelect={(file) => setSelectedFile(file)}
                error={errors.file_url}
              />
            </div>

            {/* 5. Remarks / Internal Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Remarks / Internal Notes
              </Label>
              <Textarea
                placeholder="Optional notes regarding this permit renewal, inspection date, or receipt number..."
                value={formData.notes || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="text-xs rounded-xl bg-background border-border/80 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border/70 bg-muted/10 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-8.5 px-4 text-xs font-medium rounded-lg cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8.5 px-4 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer gap-1.5"
            >
              {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>
                {isSubmitting
                  ? "Saving..."
                  : isRenewalMode
                  ? "Confirm & File Renewal"
                  : editRecord
                  ? "Save Changes"
                  : "Upload Certificate"}
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
