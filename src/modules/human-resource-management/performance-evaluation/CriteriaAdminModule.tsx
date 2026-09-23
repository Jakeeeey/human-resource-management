"use client";

import { useMemo, useState } from "react";
import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKpiCriteria } from "./hooks/useKpiCriteria";
import { usePipAreas } from "./hooks/usePipAreas";
import { EvaluationClientError } from "./providers/evaluationClient";
import type { EvaluationCriterion, PipCriterion } from "./types/performance-evaluation.schema";
import { isWeightSetValid, sumWeights } from "./utils/kpiScore";
import { KpiCriteriaEditorDialog, type KpiCriterionFormValues } from "./components/KpiCriteriaEditorDialog";
import { KpiCriteriaTable } from "./components/KpiCriteriaTable";
import { PipAreaEditorDialog, type PipAreaFormValues } from "./components/PipAreaEditorDialog";
import { PipAreasTable } from "./components/PipAreasTable";

interface CriteriaAdminModuleProps {
  scope: "hr" | "head";
}

function saveErrorMessage(err: unknown, fallback: string): string {
  return err instanceof EvaluationClientError ? err.message : fallback;
}

export function CriteriaAdminModule({ scope }: CriteriaAdminModuleProps): JSX.Element {
  const kpiEditable = scope === "hr";
  const pipEditable = scope === "head";

  const kpi = useKpiCriteria();
  const pip = usePipAreas();

  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<EvaluationCriterion | null>(null);
  const [kpiSaving, setKpiSaving] = useState(false);
  const [kpiDialogError, setKpiDialogError] = useState<string | null>(null);

  const [pipDialogOpen, setPipDialogOpen] = useState(false);
  const [editingPip, setEditingPip] = useState<PipCriterion | null>(null);
  const [pipSaving, setPipSaving] = useState(false);
  const [pipDialogError, setPipDialogError] = useState<string | null>(null);

  const activeWeightItems = useMemo(
    () =>
      kpi.rows
        .filter((row) => row.is_active)
        .map((row) => ({ weight_percentage_snapshot: row.weight_percentage })),
    [kpi.rows],
  );
  const activeWeightTotal = sumWeights(activeWeightItems);
  const weightsBalanced = isWeightSetValid(activeWeightItems);

  const openKpiCreate = () => {
    setEditingKpi(null);
    setKpiDialogError(null);
    setKpiDialogOpen(true);
  };

  const openKpiEdit = (row: EvaluationCriterion) => {
    setEditingKpi(row);
    setKpiDialogError(null);
    setKpiDialogOpen(true);
  };

  const saveKpi = async (values: KpiCriterionFormValues) => {
    setKpiSaving(true);
    setKpiDialogError(null);
    try {
      if (editingKpi) {
        await kpi.update(editingKpi.id, { ...values });
      } else {
        await kpi.create({ ...values });
      }
      setKpiDialogOpen(false);
      setEditingKpi(null);
    } catch (err) {
      setKpiDialogError(saveErrorMessage(err, "Failed to save the KPI criterion."));
    } finally {
      setKpiSaving(false);
    }
  };

  const openPipCreate = () => {
    setEditingPip(null);
    setPipDialogError(null);
    setPipDialogOpen(true);
  };

  const openPipEdit = (row: PipCriterion) => {
    setEditingPip(row);
    setPipDialogError(null);
    setPipDialogOpen(true);
  };

  const savePip = async (values: PipAreaFormValues) => {
    setPipSaving(true);
    setPipDialogError(null);
    try {
      if (editingPip) {
        await pip.update(editingPip.id, { ...values });
      } else {
        await pip.create({ ...values });
      }
      setPipDialogOpen(false);
      setEditingPip(null);
    } catch (err) {
      setPipDialogError(saveErrorMessage(err, "Failed to save the PIP area."));
    } finally {
      setPipSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluation Criteria Libraries</CardTitle>
        <CardDescription>
          HR owns the KPI criteria library; department heads own the PIP areas library.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="kpi">
          <TabsList>
            <TabsTrigger value="kpi">KPI Criteria</TabsTrigger>
            <TabsTrigger value="pip">PIP Areas</TabsTrigger>
          </TabsList>

          <TabsContent value="kpi" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={weightsBalanced ? "default" : "destructive"} aria-live="polite">
                Active weight total: {activeWeightTotal}%
              </Badge>
              {!weightsBalanced && (
                <p className="text-sm text-destructive">
                  Active criteria must total 100% before evaluations can be created.
                </p>
              )}
            </div>
            <KpiCriteriaTable
              rows={kpi.rows}
              loading={kpi.loading}
              error={kpi.error}
              editable={kpiEditable}
              readOnlyNote="The KPI library is owned by HR and is read-only here."
              onCreate={openKpiCreate}
              onEdit={openKpiEdit}
              onRemove={kpi.remove}
              onReorder={(order) => kpi.reorder({ order }).then(() => undefined)}
              onRetry={() => void kpi.refresh()}
            />
          </TabsContent>

          <TabsContent value="pip" className="space-y-3">
            <PipAreasTable
              rows={pip.rows}
              loading={pip.loading}
              error={pip.error}
              editable={pipEditable}
              readOnlyNote="The PIP areas library is owned by department heads and is read-only here."
              onCreate={openPipCreate}
              onEdit={openPipEdit}
              onRemove={pip.remove}
              onReorder={(order) => pip.reorder({ order }).then(() => undefined)}
              onRetry={() => void pip.refresh()}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <KpiCriteriaEditorDialog
        open={kpiDialogOpen}
        criterion={editingKpi}
        saving={kpiSaving}
        error={kpiDialogError}
        onClose={() => {
          if (!kpiSaving) {
            setKpiDialogOpen(false);
            setEditingKpi(null);
          }
        }}
        onSave={(values) => void saveKpi(values)}
      />

      <PipAreaEditorDialog
        open={pipDialogOpen}
        area={editingPip}
        saving={pipSaving}
        error={pipDialogError}
        onClose={() => {
          if (!pipSaving) {
            setPipDialogOpen(false);
            setEditingPip(null);
          }
        }}
        onSave={(values) => void savePip(values)}
      />
    </Card>
  );
}
