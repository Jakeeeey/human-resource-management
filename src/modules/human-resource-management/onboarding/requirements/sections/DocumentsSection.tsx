"use client";

import type { DocumentsResource } from "../providers/requirementsCatalogProvider";
import type {
  DocumentSlotRow,
  CreateDocumentSlotInput,
  UpdateDocumentSlotInput,
} from "../types/requirements-catalog.schema";
import type { CatalogColumn } from "../components/RequirementsCatalogTable";
import { RequirementsSection } from "../components/RequirementsSection";

// DocumentsSection.tsx — `onboarding_document_slot` catalog. The `doc_key` is
// the marker key referenced by portal uploads, so it is read-only after create.

const columns: readonly CatalogColumn<DocumentSlotRow>[] = [
  {
    key: "doc_key",
    header: "Key",
    className: "max-w-[220px]",
    render: (row) => (
      <code className="font-mono text-xs" title={row.doc_key}>
        {row.doc_key}
      </code>
    ),
  },
  {
    key: "title",
    header: "Title",
    className: "max-w-[420px] truncate",
    render: (row) => <span title={row.title}>{row.title}</span>,
  },
];

export function DocumentsSection({ resource }: { resource: DocumentsResource }) {
  return (
    <RequirementsSection<
      DocumentSlotRow,
      CreateDocumentSlotInput,
      UpdateDocumentSlotInput
    >
      id="documents"
      title="Documents"
      description="Hiree uploads required before onboarding is complete."
      emptyMessage="No document slots yet. Add the first required document."
      resource={resource}
      columns={columns}
      dialogFields={[
        {
          name: "doc_key",
          label: "Key",
          kind: "text",
          placeholder: "e.g. valid_id",
          required: true,
          immutable: true,
          hint: "Immutable after create — portal uploads reference this key.",
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
