"use client";

import { Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { DepartmentOption } from "../types/training-templates.schema";

// TrainingDepartmentBadge.tsx — the one token-driven badge for a template's
// scope. An EMPTY `department_ids` set is the GLOBAL template (applies to every
// department) and reads as a distinct "All departments" treatment; each set id
// resolves to a department name, falling back to the raw id when the
// department list has not loaded.

interface TrainingDepartmentBadgeProps {
  departmentIds: readonly number[];
  departments: readonly DepartmentOption[];
}

/**
 * Renders a template's department scope as one badge per department.
 * @param props The template's effective department ids and the loaded options.
 * @returns The global badge, or a badge per department.
 */
export function TrainingDepartmentBadge({
  departmentIds,
  departments,
}: TrainingDepartmentBadgeProps) {
  if (departmentIds.length === 0) {
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

  return (
    <span className="flex flex-wrap gap-1">
      {departmentIds.map((departmentId) => {
        const name =
          departments.find(
            (department) => department.department_id === departmentId
          )?.department_name ?? `Department #${departmentId}`;
        return (
          <Badge
            key={departmentId}
            variant="outline"
            aria-label={`Applies to ${name}`}
            className="shrink-0"
          >
            {name}
          </Badge>
        );
      })}
    </span>
  );
}
