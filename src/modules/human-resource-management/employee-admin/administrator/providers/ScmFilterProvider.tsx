"use client";

import React, { createContext, useContext, useMemo } from "react";
import { format, parse, startOfYear } from "date-fns";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRange } from "react-day-picker";

interface ScmFilterContextType {
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  selectedSupplier: string;
  setSelectedSupplier: (val: string) => void;
  selectedBranch: string;
  setSelectedBranch: (val: string) => void;
  selectedRiskStatus: string;
  setSelectedRiskStatus: (val: string) => void;
  selectedDepartment: string;
  setSelectedDepartment: (val: string) => void;
}

const ScmFilterContext = createContext<ScmFilterContextType | undefined>(
  undefined,
);

export function ScmFilterProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Parse from URL or default to start of year -> now
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const dateRange = useMemo(() => {
    try {
      return {
        from: fromStr
          ? parse(fromStr, "yyyy-MM-dd", new Date())
          : startOfYear(new Date()),
        to: toStr ? parse(toStr, "yyyy-MM-dd", new Date()) : new Date(),
      };
    } catch {
      return {
        from: startOfYear(new Date()),
        to: new Date(),
      };
    }
  }, [fromStr, toStr]);

  const selectedSupplier = searchParams.get("supplier") || "all";
  const selectedBranch = searchParams.get("branch_name") || "all";
  const selectedRiskStatus = searchParams.get("risk_status") || "all";
  const selectedDepartment = searchParams.get("department") || "all";

  // useCallback so consumers don't re-render just because ScmFilterProvider re-rendered
  const updateFilters = React.useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  const setDateRange = React.useCallback((range: DateRange | undefined) => {
    updateFilters({
      from: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      to: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
    });
  }, [updateFilters]);

  const setSelectedSupplier = React.useCallback((val: string) => updateFilters({ supplier: val }), [updateFilters]);
  const setSelectedBranch = React.useCallback((val: string) => updateFilters({ branch_name: val }), [updateFilters]);
  const setSelectedRiskStatus = React.useCallback((val: string) => updateFilters({ risk_status: val }), [updateFilters]);
  const setSelectedDepartment = React.useCallback((val: string) => updateFilters({ department: val }), [updateFilters]);

  // Memoize the full context value to prevent cascading re-renders across all consumers
  const contextValue = useMemo(() => ({
    dateRange,
    setDateRange,
    selectedSupplier,
    setSelectedSupplier,
    selectedBranch,
    setSelectedBranch,
    selectedRiskStatus,
    setSelectedRiskStatus,
    selectedDepartment,
    setSelectedDepartment,
  }), [
    dateRange,
    setDateRange,
    selectedSupplier,
    setSelectedSupplier,
    selectedBranch,
    setSelectedBranch,
    selectedRiskStatus,
    setSelectedRiskStatus,
    selectedDepartment,
    setSelectedDepartment,
  ]);

  return (
    <ScmFilterContext.Provider value={contextValue}>
      {children}
    </ScmFilterContext.Provider>
  );
}

export function useScmFilters() {
  const context = useContext(ScmFilterContext);
  if (context === undefined) {
    throw new Error("useScmFilters must be used within a ScmFilterProvider");
  }
  return context;
}
