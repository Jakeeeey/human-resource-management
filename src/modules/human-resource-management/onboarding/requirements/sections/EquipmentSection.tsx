"use client";

import { Badge } from "@/components/ui/badge";

import type { EquipmentResource } from "../providers/requirementsCatalogProvider";
import type {
  EquipmentItemRow,
  CreateEquipmentItemInput,
  UpdateEquipmentItemInput,
} from "../types/requirements-catalog.schema";
import type { EquipmentIssuer } from "../../equipment/types/equipment-issue.schema";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import { RequirementsSection } from "../components/RequirementsSection";

// EquipmentSection.tsx — `onboarding_equipment_item` catalog. `item_key` is
// referenced by issue/ack doc_refs, so it is read-only after create; `issuer`
// stays editable.

const columns: readonly CatalogColumn<EquipmentItemRow>[] = [
  {
    key: "item_key",
    header: "Key",
    className: "max-w-[240px]",
    render: (row) => (
      <code className="font-mono text-xs" title={row.item_key}>
        {row.item_key}
      </code>
    ),
  },
  {
    key: "label",
    header: "Label",
    className: "max-w-[380px] truncate",
    render: (row) => <span title={row.label}>{row.label}</span>,
  },
  {
    key: "issuer",
    header: "Issuer",
    render: (row) => (
      <Badge variant="outline">
        {row.issuer}
      </Badge>
    ),
  },
];

const ISSUER_OPTIONS = [
  { value: "IT", label: "IT" },
  { value: "Admin", label: "Admin" },
  { value: "Department", label: "Department" },
] as const;

export function EquipmentSection({
  resource,
}: {
  resource: EquipmentResource;
}) {
  return (
    <RequirementsSection<
      EquipmentItemRow,
      CreateEquipmentItemInput,
      UpdateEquipmentItemInput
    >
      id="equipment"
      title="Equipment"
      description="Assets issued and acknowledged during onboarding."
      emptyMessage="No equipment items yet. Add the first item."
      resource={resource}
      columns={columns}
      dialogFields={[
        {
          name: "item_key",
          label: "Key",
          kind: "text",
          placeholder: "e.g. laptop",
          required: true,
          immutable: true,
          hint: "Immutable after create — issue/ack records reference this key.",
        },
        {
          name: "label",
          label: "Label",
          kind: "text",
          placeholder: "e.g. Company laptop",
          required: true,
        },
        {
          name: "issuer",
          label: "Issuer",
          kind: "select",
          required: true,
          options: ISSUER_OPTIONS,
        },
      ]}
      createInitial={{ item_key: "", label: "", issuer: "IT" }}
      rowToInitial={(row) => ({
        item_key: row.item_key,
        label: row.label,
        issuer: row.issuer,
      })}
      toCreateInput={(values) => ({
        item_key: values.item_key.trim(),
        label: values.label.trim(),
        issuer: values.issuer as EquipmentIssuer,
      })}
      toUpdateInput={(values) => ({
        label: values.label.trim(),
        issuer: values.issuer as EquipmentIssuer,
      })}
      toRequiredInput={(row) => ({ is_required: !row.is_required })}
      toActiveInput={(row) => ({ is_active: !row.is_active })}
    />
  );
}
