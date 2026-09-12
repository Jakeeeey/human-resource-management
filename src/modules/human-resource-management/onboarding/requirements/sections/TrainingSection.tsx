"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";

import type { TaskTemplatesResource } from "../providers/requirementsCatalogProvider";
import type {
  TaskTemplateRow,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput,
} from "../types/requirements-catalog.schema";
import type { OnboardingOwnerRole } from "../../types/onboarding-task.schema";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import { RequirementsSection } from "../components/RequirementsSection";

// TrainingSection.tsx — the `onboarding_task_template` rows for phase
// `training` (the provider lists all managed phases; only training is shown
// here). `code` is read-only and the phase stays fixed at `training`.

const columns: readonly CatalogColumn<TaskTemplateRow>[] = [
  {
    key: "code",
    header: "Code",
    className: "max-w-[240px]",
    render: (row) => (
      <code className="font-mono text-xs" title={row.code}>
        {row.code}
      </code>
    ),
  },
  {
    key: "title",
    header: "Title",
    className: "max-w-[380px] truncate",
    render: (row) => <span title={row.title}>{row.title}</span>,
  },
  {
    key: "owner_role",
    header: "Owner",
    render: (row) => (
      <Badge variant="outline" className="capitalize">
        {row.owner_role}
      </Badge>
    ),
  },
];

const OWNER_ROLE_OPTIONS = [
  { value: "hr", label: "HR" },
  { value: "department", label: "Department" },
  { value: "hiree", label: "Hiree" },
  { value: "system", label: "System" },
] as const;

export function TrainingSection({
  resource,
}: {
  resource: TaskTemplatesResource;
}) {
  const trainingResource = useMemo(
    () => ({
      ...resource,
      rows: resource.rows.filter((row) => row.phase === "training"),
    }),
    [resource]
  );

  return (
    <RequirementsSection<
      TaskTemplateRow,
      CreateTaskTemplateInput,
      UpdateTaskTemplateInput
    >
      id="training"
      title="Training"
      description="Training tasks every new hire must complete."
      emptyMessage="No training requirements yet. Add the first task."
      resource={trainingResource}
      columns={columns}
      dialogFields={[
        {
          name: "code",
          label: "Code",
          kind: "text",
          placeholder: "e.g. training_policy_ack",
          required: true,
          immutable: true,
          hint: "Immutable after create.",
        },
        {
          name: "title",
          label: "Title",
          kind: "text",
          placeholder: "e.g. Acknowledge the employee handbook",
          required: true,
        },
        {
          name: "owner_role",
          label: "Owner",
          kind: "select",
          required: true,
          options: OWNER_ROLE_OPTIONS,
        },
      ]}
      createInitial={{ code: "", title: "", owner_role: "hiree" }}
      rowToInitial={(row) => ({
        code: row.code,
        title: row.title,
        owner_role: row.owner_role,
      })}
      toCreateInput={(values) => ({
        code: values.code.trim(),
        title: values.title.trim(),
        phase: "training",
        owner_role: values.owner_role as OnboardingOwnerRole,
      })}
      toUpdateInput={(values) => ({
        title: values.title.trim(),
        owner_role: values.owner_role as OnboardingOwnerRole,
      })}
      toRequiredInput={(row) => ({ is_required: !row.is_required })}
      toActiveInput={(row) => ({ is_active: !row.is_active })}
    />
  );
}
