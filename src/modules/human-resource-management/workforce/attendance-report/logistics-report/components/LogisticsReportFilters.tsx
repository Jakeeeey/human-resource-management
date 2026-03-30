"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Search } from "lucide-react";

interface LogisticsReportFiltersProps {
  startDate: string;
  endDate: string;
  searchQuery: string;
  isLoading: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSearchQueryChange: (value: string) => void;
}

export function LogisticsReportFilters({
  startDate,
  endDate,
  searchQuery,
  isLoading: _isLoading,
  onStartDateChange,
  onEndDateChange,
  onSearchQueryChange,
}: LogisticsReportFiltersProps) {
  void _isLoading;
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>Filter Report</CardTitle>
        <CardDescription>
          Select a date range to load post dispatch attendance records.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search Dispatch No..."
              className="pl-8 h-9"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                Start Date
              </span>
              <Input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="w-auto h-9"
              />
            </label>

            <label className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                End Date
              </span>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                className="w-auto h-9"
              />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
