"use client";

import { useState } from "react";
import type {
  CreatePaperworkTemplateInput,
  PaperworkTemplate,
} from "../types/paperwork-template.schema";
import { uploadPaperworkPdf } from "../providers/paperworkPdfUpload";
import { PaperworkCompanyMultiCombobox } from "./PaperworkCompanyMultiCombobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// TemplateDialog.tsx — create/edit for paperwork templates (PDF-ONLY: every
// template is an admin-uploaded PDF picked below; zones are marked in the
// separate zones editor AFTER the template exists).
// Todo 20: company scoping is a MULTI-pick over the directory — the hook
// persists the set through the `[id]/companies` junction replace route.
// When the directory is unreachable saving is blocked (there is no company
// column left to fall back to); the dialog shows a retry hint instead.
// Form state initializes from props on mount; the dialog remounts it via
// `key` per open/template so no set-state-in-effect is needed.

interface TemplateDialogProps {
  open: boolean;
  template: PaperworkTemplate | null;
  saving: boolean;
  companyOptions: { value: string; label: string; code: string }[];
  initialCompanyIds: number[];
  onClose: () => void;
  onSave: (
    data: CreatePaperworkTemplateInput,
    companyIds: number[] | null
  ) => void;
}

function TemplateDialogForm({
  template,
  saving,
  companyOptions,
  initialCompanyIds,
  onClose,
  onSave,
}: Omit<TemplateDialogProps, "open">) {
  const [companyIds, setCompanyIds] = useState<string[]>(
    initialCompanyIds.map(String)
  );
  const [title, setTitle] = useState(template?.title ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [pdfFile, setPdfFile] = useState<string | null>(
    template?.pdf_file ?? null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const directoryUp = companyOptions.length > 0;

  const handlePdfSelected = (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError(
        `Only PDF files are allowed (got ${file.type || "unknown type"})`
      );
      setFileKey((k) => k + 1);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(
        `PDF exceeds the 10 MB cap (got ${(file.size / 1024 / 1024).toFixed(2)} MB)`
      );
      setFileKey((k) => k + 1);
      return;
    }
    setUploading(true);
    void uploadPaperworkPdf(file)
      .then((id) => setPdfFile(id))
      .catch((err: unknown) =>
        setUploadError(err instanceof Error ? err.message : "PDF upload failed")
      )
      .finally(() => {
        setUploading(false);
        setFileKey((k) => k + 1);
      });
  };

  const handleSave = () => {
    setSaveError(null);
    if (title.trim() === "") {
      setSaveError("Title is required");
      return;
    }
    if (!pdfFile) {
      setUploadError("Upload a PDF file before saving");
      return;
    }
    if (!directoryUp) {
      setSaveError(
        "Company directory is unreachable — close and retry; scoping cannot be saved offline"
      );
      return;
    }
    // Empty pick is rejected with a reason — never saved.
    const ids = [
      ...new Set(
        companyIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
      ),
    ];
    if (ids.length === 0) {
      setSaveError(
        "Pick at least one company — a template must scope to one or more companies"
      );
      return;
    }
    onSave(
      {
        title: title.trim(),
        source: "pdf",
        pdf_file: pdfFile,
        is_active: isActive,
      },
      ids
    );
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw-company-key">Companies</Label>
          {directoryUp ? (
            <PaperworkCompanyMultiCombobox
              options={companyOptions}
              values={companyIds}
              onValuesChange={(next) => {
                setCompanyIds(next);
                if (next.length > 0) setSaveError(null);
              }}
              placeholder="Select companies…"
              disabled={saving}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Company directory unreachable — close and retry before saving.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-title">Title</Label>
          <Input
            id="pw-title"
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Employment contract — rank and file"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-pdf-file">PDF file (max 10 MB)</Label>
            <input
              id="pw-pdf-file"
              key={fileKey}
              type="file"
              accept="application/pdf"
              disabled={saving || uploading}
              onChange={(e) => handlePdfSelected(e.target.files?.[0])}
              className="block w-full min-h-10 text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            {uploading && (
              <p className="text-sm text-muted-foreground">Uploading PDF…</p>
            )}
            {pdfFile && (
              <div className="flex items-center gap-2">
                <code
                  className="block max-w-[280px] flex-1 truncate font-mono text-xs"
                  title={pdfFile}
                >
                  {pdfFile}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || uploading}
                  onClick={() => setPdfFile(null)}
                  className="min-h-8"
                >
                  Remove
                </Button>
              </div>
            )}
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}
          </div>
        <label
          htmlFor="pw-is-active"
          className="flex min-h-8 cursor-pointer items-center gap-2 text-sm"
        >
          <input
            id="pw-is-active"
            type="checkbox"
            className="h-4 w-4"
            checked={isActive}
            disabled={saving}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (inactive templates stay on file but leave the registry)
        </label>
        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={saving || uploading}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function TemplateDialog({
  open,
  template,
  saving,
  companyOptions,
  initialCompanyIds,
  onClose,
  onSave,
}: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] rounded-2xl max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {template ? "Edit paperwork template" : "New paperwork template"}
          </DialogTitle>
        </DialogHeader>
        {open && (
          <TemplateDialogForm
            key={`${template?.id ?? "new"}:${initialCompanyIds.join(",")}`}
            template={template}
            saving={saving}
            companyOptions={companyOptions}
            initialCompanyIds={initialCompanyIds}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
