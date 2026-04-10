"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";
import { useOperationFilters } from "../hooks/useOperationFilters";

export function OperationToolbar() {
    const { filters, setSearch, resetFilters } = useOperationFilters();

    return (
        <div className="flex flex-1 items-center space-x-2">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search operations..."
                    value={filters.search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-8"
                />
                {filters.search && (
                    <Button
                        variant="ghost"
                        onClick={resetFilters}
                        className="absolute right-0 top-0 h-full px-2 py-0 hover:bg-transparent"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {filters.search && (
                <Button
                    variant="ghost"
                    onClick={resetFilters}
                    className="h-8 px-2 lg:px-3 text-xs"
                >
                    Reset filters
                    <X className="ml-2 h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
