/**
 * Division Selector Component
 * Dropdown to select a division
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
import { DivisionWithDepartments } from "../types";

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
    return (
        <div className="space-y-2">
            <Label htmlFor="division-select">Division</Label>
            <Select
                value={selectedDivisionId?.toString() || ""}
                onValueChange={(value) => {
                    if (value === "") {
                        onSelectDivision(null);
                    } else {
                        onSelectDivision(parseInt(value));
                    }
                }}
                disabled={disabled}
            >
                <SelectTrigger id="division-select" className="w-full">
                    <SelectValue placeholder="Select a division" />
                </SelectTrigger>
                <SelectContent>
                    {divisions.map((division) => (
                        <SelectItem
                            key={division.division_id}
                            value={division.division_id.toString()}
                        >
                            {division.division_code
                                ? `${division.division_code} - ${division.division_name}`
                                : division.division_name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
