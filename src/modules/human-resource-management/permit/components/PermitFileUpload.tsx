"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermitFileUploadProps {
  value: string;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  error?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export const PermitFileUpload: React.FC<PermitFileUploadProps> = ({
  value,
  selectedFile,
  onFileSelect,
  error,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFile = (file: File) => {
    setValidationError(null);

    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const isAllowedExt = ["pdf", "png", "jpg", "jpeg", "webp"].includes(fileExt || "");
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type);

    if (!isAllowedMime && !isAllowedExt) {
      setValidationError("Invalid file type. Please upload a PDF, PNG, JPG, or WEBP document.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError("File exceeds 10MB limit. Please upload a smaller document.");
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isExistingValue = !selectedFile && Boolean(value && value !== "/uploads/permits/default_permit.pdf");
  const isDirectusAsset = isExistingValue && (value.startsWith("/assets/") || value.includes("/assets/") || /^[0-9a-f-]{36}$/i.test(value));
  const isImage =
    selectedFile?.type.startsWith("image/") ||
    (isExistingValue && (/\.(jpg|jpeg|png|webp)$/i.test(value) || (isDirectusAsset && !value.toLowerCase().includes(".pdf"))));

  return (
    <div className="space-y-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {selectedFile || isExistingValue ? (
        <div className="relative flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/90 shadow-2xs group transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary border border-primary/20 dark:border-primary/40 flex items-center justify-center shrink-0 shadow-2xs">
              {isImage ? (
                <ImageIcon className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                {selectedFile ? selectedFile.name : value.split("/").pop() || "Attached Document"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • Ready to upload`
                  : "Existing Certificate Attached"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs px-2.5 border-slate-300 dark:border-slate-600 text-foreground dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="h-7 w-7 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/10 dark:bg-primary/20 scale-[0.99]"
              : "border-slate-300 dark:border-slate-700 hover:border-primary dark:hover:border-primary bg-slate-50/60 dark:bg-slate-900/60 hover:bg-primary/[0.04] dark:hover:bg-primary/[0.08] shadow-2xs"
          }`}
        >
          <div className="h-11 w-11 rounded-xl bg-primary/10 dark:bg-primary/20 text-primary border border-primary/25 dark:border-primary/40 flex items-center justify-center mb-2.5 shadow-2xs">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-foreground text-center">
            <span className="font-semibold text-primary underline underline-offset-2">
              Click to browse
            </span>{" "}
            or drag & drop your permit document here
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 text-center font-mono">
            PDF, PNG, JPG or WEBP (up to 10MB)
          </p>
        </div>
      )}

      {(validationError || error) && (
        <div className="flex items-center gap-1.5 text-xs text-destructive mt-1 font-medium">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{validationError || error}</span>
        </div>
      )}
    </div>
  );
};
