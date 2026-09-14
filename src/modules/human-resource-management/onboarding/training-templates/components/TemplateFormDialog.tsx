"use client";

import {
  RequirementFieldDialog,
  type RequirementDialogField,
} from "@/modules/human-resource-management/onboarding/requirements/components/RequirementFieldDialog";

import { useTrainingTemplatesCatalog } from "../hooks/useTrainingTemplatesCatalog";
import {
  GLOBAL_DEPARTMENT_VALUE,
  type TrainingTemplateRow,
} from "../types/training-templates.schema";

// TemplateFormDialog.tsx — create/edit dialog for one training template.
// Reuses the shared config-driven `RequirementFieldDialog` (text fields + the
// department select); `is_active` is toggled from the template header, never
// here, so the dialog never needs a boolean or a numeric field.
//
// `code` is immutable after create — the dialog renders it read-only in edit
// mode (see `RequirementFieldDialog`).

interface TemplateFormDialogProps {
  open: boolean;
  saving: boolean;
  /** null = create mode; a row = edit mode. */
  row: TrainingTemplateRow | null;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

/**
 * Renders the training-template create/edit dialog.
 * @param props Open/saving state, the row being edited, and the save handler.
 * @returns The dialog wired to the shared field dialog.
 */
export function TemplateFormDialog({
  open,
  saving,
  row,
  onClose,
  onSave,
}: TemplateFormDialogProps) {
  const { departments } = useTrainingTemplatesCatalog();
  const isEdit = row !== null;

  const fields: readonly RequirementDialogField[] = [
    {
      name: "code",
      label: "Code",
      kind: "text",
      placeholder: "e.g. onsite_safety",
      required: true,
      immutable: true,
      hint: "Immutable after create.",
      createHint: "Required. Permanent — used as the template code.",
    },
    {
      name: "title",
      label: "Title",
      kind: "text",
      placeholder: "e.g. On-site safety training",
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
      name: "department_id",
      label: "Department",
      kind: "select",
      placeholder: "Select department…",
      hint: "Global applies to every department.",
      options: [
        { value: GLOBAL_DEPARTMENT_VALUE, label: "All departments (global)" },
        ...departments.rows.map((department) => ({
          value: String(department.department_id),
          label: department.department_name,
        })),
      ],
    },
  ];

  const initial: Record<string, string> =
    row === null
      ? {
          code: "",
          title: "",
          description: "",
          department_id: GLOBAL_DEPARTMENT_VALUE,
        }
      : {
          code: row.code,
          title: row.title,
          description: row.description ?? "",
          department_id:
            row.department_id === null
              ? GLOBAL_DEPARTMENT_VALUE
              : String(row.department_id),
        };

  return (
    <RequirementFieldDialog
      open={open}
      heading={isEdit ? "Edit training template" : "New training template"}
      description={
        isEdit
          ? "Update this template. Active is toggled directly in the table."
          : "Add a per-department or global training template."
      }
      isEdit={isEdit}
      saving={saving}
      fields={fields}
      initial={initial}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
