"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useTemplateTableControls } from "../hooks/useTemplateTableControls";
import { usePaperworkTemplates } from "../hooks/usePaperworkTemplates";
import {
    listPaperworkCompanies,
    type PaperworkCompany,
} from "../providers/paperworkCompanyProvider";
import {
    listAllTemplateCompanies,
    toTemplateCompanyMap,
} from "../providers/paperworkTemplateCompanies";
import { TemplateDialog } from "./TemplateDialog";
import { TemplatesTable } from "./TemplatesTable";
import { TemplatesTableFilters } from "./TemplatesTableFilters";
import { ZonesEditor } from "./ZonesEditor";

// TemplatesTab.tsx — paperwork registry surface: toolbar (new + refresh), the
// search/status filter row, the card table, create/edit dialog, and the
// click-drag zones editor. The tab owns the table controls so the count text,
// filters, sorting, and pagination all read from one source of truth.

export function TemplatesTab() {
  const {
    templates,
    isLoading,
    isError,
    error,
    refetch,
    selected,
    dialogOpen,
    zonesOpen,
    saving,
    openCreate,
    openEdit,
    openZones,
    closeDialog,
    closeZones,
    saveTemplate,
    saveZones,
  } = usePaperworkTemplates();

  // Company directory for the multiselect (read-only, fails soft — the
  // dialog falls back to a legacy free-text key when the directory is
  // unreachable) + the junction map (template→company ids, one call).
  const [companies, setCompanies] = useState<PaperworkCompany[]>([]);
  const [templateCompanyIds, setTemplateCompanyIds] = useState<
    Map<number, number[]>
  >(new Map());
  useEffect(() => {
    let cancelled = false;
    void listPaperworkCompanies().then((rows) => {
      if (!cancelled) setCompanies(rows);
    });
    void listAllTemplateCompanies().then((rows) => {
      if (!cancelled) setTemplateCompanyIds(toTemplateCompanyMap(rows));
    });
    return () => {
      cancelled = true;
    };
  }, [templates.length]);

  const companyById = new Map(companies.map((row) => [row.id, row]));
  const companyOptions = companies.map((row) => ({
    value: String(row.id),
    label: row.name,
    code: row.code,
  }));

  // Junction-first scoping: empty set means unscoped (dialog forces a pick
  // on the next edit).
  const companyIdsFor = (templateId: number): number[] =>
    templateCompanyIds.get(templateId) ?? [];

  const refreshJunction = () => {
    void listAllTemplateCompanies().then((rows) =>
      setTemplateCompanyIds(toTemplateCompanyMap(rows))
    );
  };

  // Display names per template, the haystack the search box matches against
  // (title + company names) and the Company(s) sort key.
  const companyNamesByTemplate = new Map<number, readonly string[]>();
  for (const template of templates) {
    companyNamesByTemplate.set(
      template.id,
      (templateCompanyIds.get(template.id) ?? []).map(
        (id) => companyById.get(id)?.name ?? `#${id}`
      )
    );
  }
  const controls = useTemplateTableControls(templates, companyNamesByTemplate);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {controls.isFiltered
            ? `Showing ${controls.filteredCount} of ${templates.length}`
            : `${templates.length} template${templates.length === 1 ? "" : "s"} on file`}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            New template
          </Button>
        </div>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load templates</AlertTitle>
          <AlertDescription>
            {error?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      <TemplatesTableFilters
        search={controls.search}
        onSearchChange={controls.setSearch}
        status={controls.status}
        onStatusChange={controls.setStatus}
        showClear={controls.isFiltered}
        onClear={controls.clearFilters}
      />

      <TemplatesTable
        controls={controls}
        isLoading={isLoading}
        templateCompanyIds={templateCompanyIds}
        companyById={companyById}
        onEdit={openEdit}
        onZones={openZones}
      />

      <TemplateDialog
        open={dialogOpen}
        template={selected}
        saving={saving}
        companyOptions={companyOptions}
        initialCompanyIds={selected ? companyIdsFor(selected.id) : []}
        onClose={closeDialog}
        onSave={(d, ids) => {
          void saveTemplate(d, ids).then(() => refreshJunction());
        }}
      />

      <ZonesEditor
        open={zonesOpen}
        template={selected}
        saving={saving}
        onClose={closeZones}
        onSave={(t, z) => void saveZones(t, z)}
      />
    </div>
  );
}
