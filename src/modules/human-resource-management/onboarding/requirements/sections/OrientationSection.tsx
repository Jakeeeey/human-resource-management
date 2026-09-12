"use client";

import type { OrientationResource } from "../providers/requirementsCatalogProvider";
import type {
  OrientationTopicCatalogRow,
  CreateOrientationTopicInput,
  UpdateOrientationTopicInput,
} from "../types/requirements-catalog.schema";
import type { OrientationTrack } from "../../orientation/types/orientation.schema";
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

// OrientationSection.tsx — `orientation_topic` catalog. Editing a topic also
// governs its DERIVED orientation-phase task template (todo 2 syncs
// `is_active`); the section therefore edits topics, never templates directly.
// `track` is fixed at create (the update contract does not accept it).

const columns: readonly CatalogColumn<OrientationTopicCatalogRow>[] = [
  {
    key: "code",
    header: "Key",
    headerTitle: "Stable identifier derived from the topic title",
    className: "max-w-[220px] truncate",
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
    headerTitle: "Topic covered during orientation",
    className: "max-w-[380px] truncate",
    render: (row) => (
      <span className="block max-w-full truncate" title={row.title}>
        {row.title}
      </span>
    ),
  },
  {
    key: "track",
    header: "Track",
    headerTitle: "Company topics are HR-owned; Department topics are owned by the hire's department",
    render: (row) => (
      <RequirementsRoleBadge kind="track" value={row.track} />
    ),
  },
];

const TRACK_OPTIONS = [
  { value: "company", label: "Company" },
  { value: "department", label: "Department" },
] as const;

const TABLE_CONFIG: RequirementsTableConfig<OrientationTopicCatalogRow> = {
  searchPlaceholder: "Search orientation topics…",
  searchText: (row) =>
    `${row.code} ${row.title} ${requirementRoleLabel("track", row.track)}`,
  getFacetValue: (row) => row.track,
  facet: { label: "Track", options: TRACK_OPTIONS },
  getRequiredValue: (row) => row.is_required,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    code: (row) => row.code,
    title: (row) => row.title,
    track: (row) => requirementRoleLabel("track", row.track),
    is_required: (row) => row.is_required,
    is_active: (row) => row.is_active,
  },
};

export function OrientationSection({
  resource,
}: {
  resource: OrientationResource;
}) {
  return (
    <RequirementsSection<
      OrientationTopicCatalogRow,
      CreateOrientationTopicInput,
      UpdateOrientationTopicInput
    >
      id="orientation"
      title="Orientation"
      entityLabel="orientation topic"
      description="Topics new hires must cover; each topic derives its checklist task."
      emptyMessage="No orientation topics yet. Add the first topic."
      resource={resource}
      columns={columns}
      rowLabel={(row) => row.title}
      tableConfig={TABLE_CONFIG}
      dialogFields={[
        {
          name: "code",
          label: "Key",
          kind: "text",
          placeholder: "Leave blank to derive from the title",
          immutable: true,
          hint: "Immutable after create — derives the orientation task code.",
          createHint: "Optional — we derive it from the title if left blank.",
        },
        {
          name: "title",
          label: "Title",
          kind: "text",
          placeholder: "e.g. Company background",
          required: true,
        },
        {
          name: "track",
          label: "Track",
          kind: "select",
          required: true,
          immutable: true,
          hint: "Company topics are owned by HR; Department topics by the hire's department.",
          options: TRACK_OPTIONS,
        },
      ]}
      createInitial={{ code: "", title: "", track: "" }}
      rowToInitial={(row) => ({
        code: row.code,
        title: row.title,
        track: row.track,
      })}
      toCreateInput={(values) => ({
        code: values.code.trim() === "" ? undefined : values.code.trim(),
        title: values.title.trim(),
        track: values.track as OrientationTrack,
      })}
      toUpdateInput={(values) => ({ title: values.title.trim() })}
      toRequiredInput={(row) => ({ is_required: !row.is_required })}
      toActiveInput={(row) => ({ is_active: !row.is_active })}
    />
  );
}
