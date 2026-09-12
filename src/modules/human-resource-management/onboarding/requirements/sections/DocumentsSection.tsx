"use client";

import type { DocumentsResource } from "../providers/requirementsCatalogProvider";
import type {
  DocumentSlotRow,
  CreateDocumentSlotInput,
  UpdateDocumentSlotInput,
} from "../types/requirements-catalog.schema";
import { humanizeIdentifier } from "../utils/humanizeIdentifier";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import {
  RequirementsSection,
  type RequirementsTableConfig,
} from "../components/RequirementsSection";

// DocumentsSection.tsx — `onboarding_document_slot` catalog. The `doc_key` is
// the marker key referenced by portal uploads, so it is read-only after create.

const columns: readonly CatalogColumn<DocumentSlotRow>[] = [
  {
    key: "doc_key",
    header: "Key",
    headerTitle: "Stable identifier referenced by portal uploads",
    className: "max-w-[220px] truncate",
    render: (row) => (
      <code
        className="block max-w-full truncate font-mono text-xs"
        title={row.doc_key}
      >
        {humanizeIdentifier(row.doc_key)}
      </code>
    ),
  },
  {
    key: "title",
    header: "Title",
    headerTitle: "Document name shown to new hires",
    className: "max-w-[420px] truncate",
    render: (row) => (
      <span className="block max-w-full truncate" title={row.title}>
        {row.title}
      </span>
    ),
  },
];

const TABLE_CONFIG: RequirementsTableConfig<DocumentSlotRow> = {
  searchPlaceholder: "Search documents…",
  searchText: (row) => `${row.doc_key} ${row.title}`,
  getRequiredValue: (row) => row.is_required,
  getActiveValue: (row) => row.is_active,
  sortAccessors: {
    doc_key: (row) => row.doc_key,
    title: (row) => row.title,
    is_required: (row) => row.is_required,
    is_active: (row) => row.is_active,
  },
};

export function DocumentsSection({ resource }: { resource: DocumentsResource }) {
  return (
    <RequirementsSection<
      DocumentSlotRow,
      CreateDocumentSlotInput,
      UpdateDocumentSlotInput
    >
      id="documents"
      title="Documents"
      entityLabel="document"
      description="Documents new hires must upload before onboarding is complete."
      emptyMessage="No document slots yet. Add the first required document."
      resource={resource}
      columns={columns}
      rowLabel={(row) => row.title}
      tableConfig={TABLE_CONFIG}
      dialogFields={[
        {
          name: "doc_key",
          label: "Key",
          kind: "text",
          placeholder: "e.g. valid_id",
          required: true,
          immutable: true,
          hint: "Immutable after create — portal uploads reference this key.",
          createHint:
            "Required. Permanent — portal uploads reference this key.",
        },
        {
          name: "title",
          label: "Title",
          kind: "text",
          placeholder: "e.g. Valid government ID",
          required: true,
        },
      ]}
      createInitial={{ doc_key: "", title: "" }}
      rowToInitial={(row) => ({ doc_key: row.doc_key, title: row.title })}
      toCreateInput={(values) => ({
        doc_key: values.doc_key.trim(),
        title: values.title.trim(),
      })}
      toUpdateInput={(values) => ({ title: values.title.trim() })}
      toRequiredInput={(row) => ({ is_required: !row.is_required })}
      toActiveInput={(row) => ({ is_active: !row.is_active })}
    />
  );
}
