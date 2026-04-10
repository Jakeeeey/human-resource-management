"use client";

// employee-report/EmployeeReportModule.tsx
import { useState } from "react";
import { subDays, format } from "date-fns";
import { EmployeeListView }      from "./components/EmployeeListView";
import { EmployeeHistoryView }   from "./components/EmployeeHistoryView";
import type { Employee }         from "./hooks/useEmployeeReport";
import { useEmployeeAttendance } from "./hooks/useEmployeeReport";

// ── Inner panel: owns the data fetch for a selected employee ──────────────────
function HistoryPanel({
  employee, from, to, onBack, onFromChange, onToChange,
}: {
  employee:     Employee;
  from:         string;
  to:           string;
  onBack:       () => void;
  onFromChange: (v: string) => void;
  onToChange:   (v: string) => void;
}) {
  const { loading, error, logs } = useEmployeeAttendance(employee.user_id, from, to);

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      Loading attendance history…
    </div>
  );
  if (error) return (
    <div className="text-sm text-red-600 px-4 py-6">Error: {error}</div>
  );

  return (
    <EmployeeHistoryView
      employee={employee}
      logs={logs}
      from={from}
      to={to}
      onBack={onBack}
      onFromChange={onFromChange}
      onToChange={onToChange}
    />
  );
}

// ── Main module ───────────────────────────────────────────────────────────────
export default function EmployeeReportModule() {
  const [selected, setSelected] = useState<Employee | null>(null);

  // Date range lives here so Quick Filter inside EmployeeHistoryView can update it
  // and HistoryPanel re-fetches automatically
  const [from, setFrom] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [to,   setTo]   = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen w-full box-border overflow-x-hidden">
      {selected ? (
        <HistoryPanel
          employee={selected}
          from={from}
          to={to}
          onBack={() => setSelected(null)}
          onFromChange={setFrom}
          onToChange={setTo}
        />
      ) : (
        <EmployeeListView onSelect={setSelected} />
      )}
    </div>
  );
}