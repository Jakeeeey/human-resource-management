"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpiCriteria } from "./hooks/useKpiCriteria";
import { EvaluationClientError, getRoster } from "./providers/evaluationClient";
import type { EvaluationCriterion } from "./types/performance-evaluation.schema";
import { KpiCriteriaEditorDialog, type KpiCriterionFormValues } from "./components/KpiCriteriaEditorDialog";
import { KpiCriteriaTable } from "./components/KpiCriteriaTable";

interface CriteriaAdminModuleProps {
  scope: "hr" | "head";
}

interface HeadDepartment {
  id: number;
  name: string;
}

function saveErrorMessage(err: unknown, fallback: string): string {
  return err instanceof EvaluationClientError ? err.message : fallback;
}

function HeadCriteriaAdmin(): JSX.Element {
  const [departments, setDepartments] = useState<HeadDepartment[] | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoster("head")
      .then((rows) => {
        if (cancelled) return;
        const seen = new Map<number, string>();
        for (const row of rows) {
          if (row.department_id === null || seen.has(row.department_id)) continue;
          const name = row.department_name?.trim() || `Department ${row.department_id}`;
          seen.set(row.department_id, name);
        }
        setDepartments(
          [...seen]
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveDepartmentId =
    departments !== null && departments.length > 1
      ? (selectedDepartmentId ?? departments[0]?.id)
      : undefined;

  const kpi = useKpiCriteria(effectiveDepartmentId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EvaluationCriterion | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: EvaluationCriterion) => {
    setEditing(row);
    setDialogError(null);
    setDialogOpen(true);
  };

  const save = async (values: KpiCriterionFormValues) => {
    setSaving(true);
    setDialogError(null);
    try {
      if (editing) {
        await kpi.update(editing.id, { ...values });
      } else {
        await kpi.create({ ...values });
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      setDialogError(saveErrorMessage(err, "Failed to save the KPI criterion."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>KPI Criteria Library</CardTitle>
        <CardDescription>
          Managed per department by the department head. Active criteria must total 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {departments === null ? (
          <Skeleton className="h-10 w-64" />
        ) : departments.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="criteria-department">Department</Label>
            <Select
              value={effectiveDepartmentId === undefined ? "" : String(effectiveDepartmentId)}
              onValueChange={(value) => setSelectedDepartmentId(Number(value))}
            >
              <SelectTrigger id="criteria-department" className="w-64" aria-label="Department">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={String(department.id)}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <KpiCriteriaTable
          rows={kpi.rows}
          loading={kpi.loading}
          error={kpi.error}
          editable
          readOnlyNote=""
          onCreate={openCreate}
          onEdit={openEdit}
          onRemove={kpi.remove}
          onReorder={(order) => kpi.reorder({ order }).then(() => undefined)}
          onRetry={() => void kpi.refresh()}
        />
      </CardContent>

      <KpiCriteriaEditorDialog
        open={dialogOpen}
        criterion={editing}
        saving={saving}
        error={dialogError}
        onClose={() => {
          if (!saving) {
            setDialogOpen(false);
            setEditing(null);
          }
        }}
        onSave={(values) => void save(values)}
      />
    </Card>
  );
}

export function CriteriaAdminModule({ scope }: CriteriaAdminModuleProps): JSX.Element {
  if (scope === "hr") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KPI Criteria Library</CardTitle>
          <CardDescription>Department KPI criteria, managed by department heads.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            KPI criteria are managed per department by the department head and are read-only here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <HeadCriteriaAdmin />;
}
