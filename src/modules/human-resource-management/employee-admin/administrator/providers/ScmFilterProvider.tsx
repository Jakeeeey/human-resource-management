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

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setDateRange = (range: DateRange | undefined) => {
    updateFilters({
      from: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      to: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
    });
  };

  return (
    <ScmFilterContext.Provider
      value={{
        dateRange,
        setDateRange,
        selectedSupplier,
        setSelectedSupplier: (val) => updateFilters({ supplier: val }),
        selectedBranch,
        setSelectedBranch: (val) => updateFilters({ branch_name: val }),
        selectedRiskStatus,
        setSelectedRiskStatus: (val) => updateFilters({ risk_status: val }),
        selectedDepartment,
        setSelectedDepartment: (val) => updateFilters({ department: val }),
      }}
    >
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
