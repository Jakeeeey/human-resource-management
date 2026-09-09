"use client";

import { useState } from "react";
import type {
  CreatePaperworkTemplateInput,
  PaperworkTemplate,
} from "../types/paperwork-template.schema";
import { PaperworkTemplateEditor } from "./PaperworkTemplateEditor";
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

// TemplateDialog.tsx — create/edit for paperwork templates (Quill-built HTML
// body, per-company key, active flag). Zones are marked in the separate zones
// editor AFTER the template exists (zones PATCH needs the template id).
// Form state initializes from props on mount; the dialog remounts it via
// `key` per open/template so no set-state-in-effect is needed.

interface TemplateDialogProps {
  open: boolean;
  template: PaperworkTemplate | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: CreatePaperworkTemplateInput) => void;
}

function TemplateDialogForm({
  template,
  saving,
  onClose,
  onSave,
}: Omit<TemplateDialogProps, "open">) {
  const [companyKey, setCompanyKey] = useState(template?.company_key ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [bodyHtml, setBodyHtml] = useState(template?.body_html ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);

  const handleSave = () => {
    if (companyKey.trim() === "" || title.trim() === "" || bodyHtml.trim() === "") return;
    onSave({
      company_key: companyKey.trim(),
      title: title.trim(),
      body_html: bodyHtml,
      is_active: isActive,
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw-company-key">Company key</Label>
          <Input
            id="pw-company-key"
            value={companyKey}
            disabled={template !== null || saving}
            onChange={(e) => setCompanyKey(e.target.value)}
            placeholder="Per-company scope, e.g. acme-ph"
          />
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
        <div className="flex min-h-60 flex-col space-y-2">
          <Label id="pw-body-label">Body (HTML)</Label>
          <PaperworkTemplateEditor value={bodyHtml} onChange={setBodyHtml} />
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
      </div>
      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
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
            key={template?.id ?? "new"}
            template={template}
            saving={saving}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
