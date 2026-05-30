/**
 * Division Selector Component
 * Dropdown to select a division
 */

"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { DivisionWithDepartments } from "../types";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface DivisionSelectorProps {
    divisions: DivisionWithDepartments[];
    selectedDivisionId: number | null;
    onSelectDivision: (divisionId: number | null) => void;
    disabled?: boolean;
}

export function DivisionSelector({
    divisions,
    selectedDivisionId,
    onSelectDivision,
    disabled = false,
}: DivisionSelectorProps) {
    const options = React.useMemo(() => {
        return divisions.map((division) => ({
            value: division.division_id.toString(),
            label: division.division_code
                ? `${division.division_code} - ${division.division_name}`
                : division.division_name,
        }));
    }, [divisions]);

    return (
        <div className="space-y-2">
            <Label htmlFor="division-select">Division</Label>
            <SearchableSelect
                options={options}
                value={selectedDivisionId?.toString() || ""}
                onValueChange={(value) => {
                    if (!value) {
                        onSelectDivision(null);
                    } else {
                        onSelectDivision(parseInt(value));
                    }
                }}
                placeholder="Select a division"
                disabled={disabled}
            />
        </div>
    );
}
