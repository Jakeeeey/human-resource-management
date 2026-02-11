/**
 * Department Selector Component
 * Dropdown to select a department within a division
 */

"use client";

import React from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DepartmentPerDivision } from "../types";

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
    return (
        <div className="space-y-2">
            <Label htmlFor="department-select">Department</Label>
            <Select
                value={selectedDeptDivId?.toString() || ""}
                onValueChange={(value) => {
                    if (value === "") {
                        onSelectDepartment(null);
                    } else {
                        onSelectDepartment(parseInt(value));
                    }
                }}
                disabled={disabled || departments.length === 0}
            >
                <SelectTrigger id="department-select" className="w-full">
                    <SelectValue
                        placeholder={
                            departments.length === 0
                                ? "No departments available"
                                : "Select a department"
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {departments.map((deptPerDiv) => (
                        <SelectItem
                            key={deptPerDiv.id}
                            value={deptPerDiv.id.toString()}
                        >
                            {deptPerDiv.department?.department_name || `Department ${deptPerDiv.department_id}`}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
