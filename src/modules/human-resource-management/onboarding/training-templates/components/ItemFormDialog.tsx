"use client";

import {
  RequirementFieldDialog,
  type RequirementDialogField,
} from "@/modules/human-resource-management/onboarding/requirements/components/RequirementFieldDialog";

import type { TrainingItemRow } from "../types/training-templates.schema";

// ItemFormDialog.tsx — create/edit dialog for one training item. Reuses the
// shared `RequirementFieldDialog`; `is_required` and `is_active` are table
// Switch toggles and are deliberately absent here. `sort_order` is exposed as a
// plain text field and parsed to a number by the caller before the update call
// (the shared dialog has no numeric kind).

const ITEM_FIELDS: readonly RequirementDialogField[] = [
  {
    name: "code",
    label: "Code",
    kind: "text",
    placeholder: "e.g. fire_drill",
    required: true,
    immutable: true,
    hint: "Immutable after create.",
    createHint: "Required. Permanent — used as the item code.",
  },
  {
    name: "title",
    label: "Title",
    kind: "text",
    placeholder: "e.g. Fire drill and evacuation",
    required: true,
  },
  {
    name: "description",
    label: "Description",
    kind: "text",
    placeholder: "Optional summary",
    hint: "Optional.",
    createHint: "Optional.",
  },
  {
    name: "sort_order",
    label: "Sort order",
    kind: "text",
    placeholder: "e.g. 10",
    hint: "Whole number; items sort ascending.",
    createHint: "Optional whole number; blank assigns the next position.",
  },
];

interface ItemFormDialogProps {
  open: boolean;
  saving: boolean;
  /** null = create mode; a row = edit mode. */
  row: TrainingItemRow | null;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Renders the training-item create/edit dialog.
 * @param props Open/saving state, the row being edited, and the save handler.
 * @returns The dialog wired to the shared field dialog.
 */
export function ItemFormDialog({
  open,
  saving,
  row,
  onClose,
  onSave,
}: ItemFormDialogProps) {
  const isEdit = row !== null;

  const initial: Record<string, string> =
    row === null
      ? { code: "", title: "", description: "", sort_order: "" }
      : {
          code: row.code,
          title: row.title,
          description: row.description ?? "",
          sort_order: String(row.sort_order),
        };

  return (
    <RequirementFieldDialog
      open={open}
      heading={isEdit ? "Edit training item" : "New training item"}
      description={
        isEdit
          ? "Update this topic. Required and Active are toggled in the table."
          : "Add a training topic to this template."
      }
      isEdit={isEdit}
      saving={saving}
      fields={ITEM_FIELDS}
      initial={initial}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
