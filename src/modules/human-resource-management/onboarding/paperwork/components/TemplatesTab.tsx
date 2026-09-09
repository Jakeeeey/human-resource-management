"use client";

import { usePaperworkTemplates } from "../hooks/usePaperworkTemplates";
import { TemplatesTable } from "./TemplatesTable";
import { TemplateDialog } from "./TemplateDialog";
import { ZonesEditor } from "./ZonesEditor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus, RefreshCw } from "lucide-react";

// TemplatesTab.tsx — paperwork registry surface: toolbar (new + retry),
// table, create/edit dialog, click-drag zones editor. Todo 7 consumes the
// stored zones[] + the single `isPaperworkValid` predicate from here.

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length === 1 ? "" : "s"} on file
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
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

      <TemplatesTable
        templates={templates}
        isLoading={isLoading}
        onEdit={openEdit}
        onZones={openZones}
      />

      <TemplateDialog
        open={dialogOpen}
        template={selected}
        saving={saving}
        onClose={closeDialog}
        onSave={(d) => void saveTemplate(d)}
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
