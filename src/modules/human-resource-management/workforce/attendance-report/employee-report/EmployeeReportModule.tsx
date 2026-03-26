"use client";

// employee-report/EmployeeReportModule.tsx
import { useState } from "react";
import { EmployeeListView }    from "./components/EmployeeListView";
import { EmployeeHistoryView } from "./components/EmployeeHistoryView";
import type { Employee }       from "./hooks/useEmployeeReport";

export default function EmployeeReportModule() {
  const [selected, setSelected] = useState<Employee | null>(null);

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen w-full box-border overflow-hidden">
      {selected ? (
        <EmployeeHistoryView employee={selected} onBack={() => setSelected(null)} />
      ) : (
        <EmployeeListView onSelect={setSelected} />
      )}
    </div>
  );
}