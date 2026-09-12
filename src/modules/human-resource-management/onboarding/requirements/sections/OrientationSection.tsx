"use client";

import { Badge } from "@/components/ui/badge";

import type { OrientationResource } from "../providers/requirementsCatalogProvider";
import type {
  OrientationTopicCatalogRow,
  CreateOrientationTopicInput,
  UpdateOrientationTopicInput,
} from "../types/requirements-catalog.schema";
import type { OrientationTrack } from "../../orientation/types/orientation.schema";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import { RequirementsSection } from "../components/RequirementsSection";

// OrientationSection.tsx — `orientation_topic` catalog. Editing a topic also
// governs its DERIVED orientation-phase task template (todo 2 syncs
// `is_active`); the section therefore edits topics, never templates directly.
// `track` is fixed at create (the update contract does not accept it).

const columns: readonly CatalogColumn<OrientationTopicCatalogRow>[] = [
  {
    key: "code",
    header: "Key",
    className: "max-w-[220px]",
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
    key: "track",
    header: "Track",
    render: (row) => (
      <Badge variant="outline" className="capitalize">
        {row.track}
      </Badge>
    ),
  },
];

const TRACK_OPTIONS = [
  { value: "company", label: "Company (HR-owned)" },
  { value: "department", label: "Department" },
] as const;

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
      description="Topics new hires must cover; each topic derives its checklist task."
      emptyMessage="No orientation topics yet. Add the first topic."
      resource={resource}
      columns={columns}
      dialogFields={[
        {
          name: "code",
          label: "Key",
          kind: "text",
          placeholder: "Leave blank to derive from the title",
          immutable: true,
          hint: "Immutable after create — derives the orientation task code.",
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
          options: TRACK_OPTIONS,
        },
      ]}
      createInitial={{ code: "", title: "", track: "company" }}
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
