"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TopsheetUserSummary } from "../type";

interface TopsheetSummaryTableProps {
  data: TopsheetUserSummary[];
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function TopsheetSummaryTable({ data }: TopsheetSummaryTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No approved overtime requests found for the selected filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
          <TableRow>
            <TableHead>Employee Name</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Total Approved OT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((userSum) => (
            <TableRow key={userSum.user_id}>
              <TableCell className="font-medium">{userSum.employee_name}</TableCell>
              <TableCell>{userSum.department_name || "N/A"}</TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {formatMinutesToHours(userSum.total_duration_minutes)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
