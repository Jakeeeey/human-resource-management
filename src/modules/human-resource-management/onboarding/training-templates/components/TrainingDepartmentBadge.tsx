"use client";

import { Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { DepartmentOption } from "../types/training-templates.schema";

// TrainingDepartmentBadge.tsx — the one token-driven badge for a template's
// scope. A null `department_id` is the GLOBAL template (applies to every
// department) and reads as a distinct "All departments" treatment; a set id
// resolves to the department name, falling back to the raw id when the
// department list has not loaded.

interface TrainingDepartmentBadgeProps {
  departmentId: number | null;
  departments: readonly DepartmentOption[];
}

/**
 * Renders a template's department scope as a badge.
 * @param props The template's `department_id` and the loaded department options.
 * @returns A badge whose label is the scope.
 */
export function TrainingDepartmentBadge({
  departmentId,
  departments,
}: TrainingDepartmentBadgeProps) {
  if (departmentId === null) {
    return (
      <Badge
        variant="secondary"
        aria-label="Applies to every department"
        className="shrink-0"
      >
        <Globe2 className="mr-1 h-3 w-3" aria-hidden="true" />
        All departments
      </Badge>
    );
  }

  const name =
    departments.find((department) => department.department_id === departmentId)
      ?.department_name ?? `Department #${departmentId}`;

  return (
    <Badge
      variant="outline"
      aria-label={`Applies to ${name} only`}
      className="shrink-0"
    >
      {name}
    </Badge>
  );
}
