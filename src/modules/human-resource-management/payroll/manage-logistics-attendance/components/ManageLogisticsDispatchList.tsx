"use client";

import { DispatchAttendance } from "../type";
import { useState } from "react";
import { EditDispatchStaffDialog } from "./EditDispatchStaffDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface ManageLogisticsDispatchListProps {
  dispatches: DispatchAttendance[];
  isLoading: boolean;
  onUpdateStaff: (payload: { dispatchPlanId: number; isExtra?: boolean; driverId: number | null; helperIds: number[]; timeOfDispatch?: string | null; vehicleId?: number | null; isNotPayroll?: boolean; area?: string; }) => Promise<{ success: boolean; } | void>;
}

export function ManageLogisticsDispatchList({
  dispatches,
  isLoading,
  onUpdateStaff,
}: ManageLogisticsDispatchListProps) {
  const [editingRecord, setEditingRecord] = useState<DispatchAttendance | null>(null);

  return (
    <div className="rounded-md border bg-white overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="font-semibold text-slate-700 text-xs">PDP No</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Location</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Area</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Vehicle Type</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Driver ID</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Helpers</TableHead>
            <TableHead className="font-semibold text-slate-700 text-xs">Time of Dispatch</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 text-xs">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                Loading dispatches...
              </TableCell>
            </TableRow>
          ) : dispatches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                No dispatch plans found.
              </TableCell>
            </TableRow>
          ) : (
            dispatches.map((record) => {
              // Ensure area is rendered correctly
              const area = record.areaName && record.areaName !== "N/A" 
                ? record.areaName 
                : "-";
              
              return (
              <TableRow key={record.dispatchPlanId} className={`hover:bg-slate-50/50 ${record.isNotPayroll ? 'bg-red-50/50 hover:bg-red-100/50' : ''}`}>
                <TableCell className="font-medium text-slate-900 text-sm align-top">
                  {record.dispatchDocNo || `PDP-${record.dispatchPlanId}`}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                  {[record.brgy, record.city, record.province].filter(Boolean).join(", ") || "-"}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                  {area}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                  {record.vehicleType || "Unknown"}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                  {record.driverName || record.driverId || "Unassigned"}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                  {record.staff && record.staff.length > 0 ? (
                    <ul className="list-disc pl-4">
                        {record.staff.map((s, idx) => (
                            <li key={idx}>{s.staffName || `ID: ${s.staffUserId}`}</li>
                        ))}
                    </ul>
                  ) : (
                    "No helpers"
                  )}
                </TableCell>
                <TableCell className="text-slate-600 text-sm align-top">
                    {record.timeOfDispatch ? new Date(record.timeOfDispatch).toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-right text-sm align-top">
                  <div className="flex flex-col gap-2 items-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingRecord(record)}>
                      Edit Staff
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={record.isNotPayroll ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-red-600 hover:text-red-700 hover:bg-red-50"}
                      onClick={() => onUpdateStaff({
                        dispatchPlanId: record.dispatchPlanId as number,
                        isExtra: record.isExtra,
                        driverId: record.driverId,
                        helperIds: record.staff.filter(s => s.staffRole === 'Helper' && s.staffUserId).map(s => s.staffUserId as number),
                        isNotPayroll: !record.isNotPayroll
                      })}
                    >
                      {record.isNotPayroll ? "Restore" : "Disregard"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <EditDispatchStaffDialog
        isOpen={!!editingRecord}
        onOpenChange={(open) => {
            if (!open) setEditingRecord(null);
        }}
        dispatchRecord={editingRecord}
        onSave={async (payload) => {
            await onUpdateStaff(payload);
        }}
      />
    </div>
  );
}
