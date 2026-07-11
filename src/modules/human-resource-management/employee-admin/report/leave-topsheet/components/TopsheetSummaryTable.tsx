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

export function TopsheetSummaryTable({ data }: TopsheetSummaryTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No approved leave requests found for the selected filters.
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
            <TableHead className="text-right">Total Approved Leave Days</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((userSum) => (
            <TableRow key={userSum.user_id}>
              <TableCell className="font-medium">{userSum.employee_name}</TableCell>
              <TableCell>{userSum.department_name || "N/A"}</TableCell>
              <TableCell className="text-right font-semibold text-primary">
                {userSum.total_leave_days}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
