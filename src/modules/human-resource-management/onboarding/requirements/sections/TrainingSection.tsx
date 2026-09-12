"use client";

import { useMemo } from "react";

import type { TaskTemplatesResource } from "../providers/requirementsCatalogProvider";
import type {
  TaskTemplateRow,
  CreateTaskTemplateInput,
  UpdateTaskTemplateInput,
} from "../types/requirements-catalog.schema";
import type { OnboardingOwnerRole } from "../../types/onboarding-task.schema";
import { humanizeIdentifier } from "../utils/humanizeIdentifier";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import {
  requirementRoleLabel,
  RequirementsRoleBadge,
} from "../components/RequirementsRoleBadge";
import {
  RequirementsSection,
  type RequirementsTableConfig,
} from "../components/RequirementsSection";

// TrainingSection.tsx — the `onboarding_task_template` rows for phase
// `training` (the provider lists all managed phases; only training is shown
// here). `code` is read-only and the phase stays fixed at `training`.

const columns: readonly CatalogColumn<TaskTemplateRow>[] = [
  {
    key: "code",
    header: "Key",
    headerTitle: "Stable task code, immutable after create",
    className: "max-w-[240px] truncate",
    render: (row) => (
      <code
        className="block max-w-full truncate font-mono text-xs"
        title={row.code}
      >
        {humanizeIdentifier(row.code)}
      </code>
    ),
  },
  {
    key: "title",
    header: "Title",
    headerTitle: "Training task shown to new hires",
    className: "max-w-[380px] truncate",
    render: (row) => (
      <span className="block max-w-full truncate" title={row.title}>
        {row.title}
      </span>
    ),
  },
  {
    key: "owner_role",
    header: "Owner",
    headerTitle:
      "Who performs the step: HR, the hire's Department, the new hire, or System",
    render: (row) => (
      <RequirementsRoleBadge kind="owner" value={row.owner_role} />
    ),
  },
];

const OWNER_ROLE_OPTIONS = [
  { value: "hr", label: "HR" },
  { value: "department", label: "Department" },
  { value: "hiree", label: "New hire" },
  { value: "system", label: "System" },
] as const;

const TABLE_CONFIG: RequirementsTableConfig<TaskTemplateRow> = {
  searchPlaceholder: "Search training tasks…",
  searchText: (row) =>
    `${row.code} ${row.title} ${requirementRoleLabel("owner", row.owner_role)}`,
  getFacetValue: (row) => row.owner_role,
  facet: { label: "Owner", options: OWNER_ROLE_OPTIONS },
  getRequiredValue: (row) => row.is_required,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    code: (row) => row.code,
    title: (row) => row.title,
    owner_role: (row) => requirementRoleLabel("owner", row.owner_role),
    is_required: (row) => row.is_required,
    is_active: (row) => row.is_active,
  },
};

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
      entityLabel="training task"
      description="Training tasks every new hire must complete."
      emptyMessage="No training requirements yet. Add the first task."
      resource={trainingResource}
      columns={columns}
      rowLabel={(row) => row.title}
      tableConfig={TABLE_CONFIG}
      dialogFields={[
        {
          name: "code",
          label: "Key",
          kind: "text",
          placeholder: "e.g. training_policy_ack",
          required: true,
          immutable: true,
          hint: "Immutable after create.",
          createHint: "Required. Permanent — used as the task code.",
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
          placeholder: "Select owner…",
          required: true,
          hint: "Who performs this step: HR, the hire's Department, the new hire, or System.",
          options: OWNER_ROLE_OPTIONS,
        },
      ]}
      createInitial={{ code: "", title: "", owner_role: "" }}
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
