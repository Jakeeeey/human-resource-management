/**
 * Department Selector Component
 * Dropdown to select a department within a division
 */

"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { DepartmentPerDivision } from "../types";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface DepartmentSelectorProps {
    departments: DepartmentPerDivision[];
    selectedDeptDivId: number | null;
    onSelectDepartment: (deptDivId: number | null) => void;
    disabled?: boolean;
}

export function DepartmentSelector({
    departments,
    selectedDeptDivId,
    onSelectDepartment,
    disabled = false,
}: DepartmentSelectorProps) {
    const options = React.useMemo(() => {
        return departments.map((deptPerDiv) => ({
            value: deptPerDiv.id.toString(),
            label: deptPerDiv.department?.department_name || `Department ${deptPerDiv.department_id}`,
        }));
    }, [departments]);

    return (
        <div className="space-y-2">
            <Label htmlFor="department-select">Department</Label>
            <SearchableSelect
                options={options}
                value={selectedDeptDivId?.toString() || ""}
                onValueChange={(value) => {
                    if (!value) {
                        onSelectDepartment(null);
                    } else {
                        onSelectDepartment(parseInt(value));
                    }
                }}
                placeholder={
                    departments.length === 0
                        ? "No departments available"
                        : "Select a department"
                }
                disabled={disabled || departments.length === 0}
            />
        </div>
    );
}
