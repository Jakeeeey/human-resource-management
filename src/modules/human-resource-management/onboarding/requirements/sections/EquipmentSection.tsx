"use client";

import type { EquipmentResource } from "../providers/requirementsCatalogProvider";
import type {
  EquipmentItemRow,
  CreateEquipmentItemInput,
  UpdateEquipmentItemInput,
} from "../types/requirements-catalog.schema";
import type { EquipmentIssuer } from "../../equipment/types/equipment-issue.schema";
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

// EquipmentSection.tsx — `onboarding_equipment_item` catalog. `item_key` is
// referenced by issue/ack doc_refs, so it is read-only after create; `issuer`
// stays editable.

const columns: readonly CatalogColumn<EquipmentItemRow>[] = [
  {
    key: "item_key",
    header: "Key",
    headerTitle: "Internal identifier referenced by issue records",
    className: "max-w-[240px] truncate",
    render: (row) => (
      <code
        className="block max-w-full truncate font-mono text-xs"
        title={row.item_key}
      >
        {humanizeIdentifier(row.item_key)}
      </code>
    ),
  },
  {
    key: "label",
    header: "Label",
    headerTitle: "Equipment name shown to new hires",
    className: "max-w-[380px] truncate",
    render: (row) => (
      <span className="block max-w-full truncate" title={row.label}>
        {row.label}
      </span>
    ),
  },
  {
    key: "issuer",
    header: "Issuer",
    headerTitle: "Who provides and tracks this item: IT, Admin, or the hire's department",
    render: (row) => (
      <RequirementsRoleBadge kind="issuer" value={row.issuer} />
    ),
  },
];

const ISSUER_OPTIONS = [
  { value: "IT", label: "IT" },
  { value: "Admin", label: "Admin" },
  { value: "Department", label: "Department" },
] as const;

const TABLE_CONFIG: RequirementsTableConfig<EquipmentItemRow> = {
  searchPlaceholder: "Search equipment…",
  searchText: (row) =>
    `${row.item_key} ${row.label} ${requirementRoleLabel("issuer", row.issuer)}`,
  getFacetValue: (row) => row.issuer,
  facet: { label: "Issuer", options: ISSUER_OPTIONS },
  getRequiredValue: (row) => row.is_required,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    item_key: (row) => row.item_key,
    label: (row) => row.label,
    issuer: (row) => requirementRoleLabel("issuer", row.issuer),
    is_required: (row) => row.is_required,
    is_active: (row) => row.is_active,
  },
};

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
      entityLabel="equipment item"
      description="Equipment issued to new hires during onboarding."
      emptyMessage="No equipment items yet. Add the first item."
      resource={resource}
      columns={columns}
      rowLabel={(row) => row.label}
      tableConfig={TABLE_CONFIG}
      dialogFields={[
        {
          name: "item_key",
          label: "Key",
          kind: "text",
          placeholder: "e.g. laptop",
          required: true,
          immutable: true,
          hint: "Immutable after create — issue/ack records reference this key.",
          createHint:
            "Required. Permanent — issue records reference this key.",
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
          placeholder: "Select issuer…",
          required: true,
          hint: "Who provides and tracks this item: IT, Admin, or the hire's department.",
          options: ISSUER_OPTIONS,
        },
      ]}
      createInitial={{ item_key: "", label: "", issuer: "" }}
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
