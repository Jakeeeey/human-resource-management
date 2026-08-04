"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEmployeeTypeFilterContext } from "../providers/filterProvider";
import { X } from "lucide-react";

export function EmployeeTypeToolbar() {
    const { filters, setFilters, resetFilters } = useEmployeeTypeFilterContext();
    const isFiltered = Object.values(filters).some((v) => v !== "");

    return (
        <div className="flex items-center space-x-2">
            <Input
                placeholder="Search..."
                value={filters.search}
                onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="h-8 w-[150px] lg:w-[250px]"
            />
            {isFiltered && (
                <Button
                    variant="ghost"
                    onClick={resetFilters}
                    className="h-8 px-2 lg:px-3"
                >
                    Reset
                    <X className="ml-2 h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
