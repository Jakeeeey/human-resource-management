"use client";

import { ManageLogisticsHeader } from "./components/ManageLogisticsHeader";
import { ManageLogisticsDispatchList } from "./components/ManageLogisticsDispatchList";
import { AddManualDispatchDialog } from "./components/AddManualDispatchDialog";
import { useManageLogisticsAttendance } from "./hooks/useManageLogisticsAttendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useState } from "react";

export function ManageLogisticsAttendanceModule() {
  const {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    searchQuery,
    setSearchQuery,
    driverFilter,
    setDriverFilter,
    helperFilter,
    setHelperFilter,
    paginatedDispatches,
    isLoading,
    error,
    currentPage,
    totalPages,
    setCurrentPage,
    updateDispatchStaff,
    addManualDispatch,
  } = useManageLogisticsAttendance();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 mx-auto max-w-screen-2xl">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Manage Logistics Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Review and update driver and helper assignments for logistics dispatch plans across cutoff periods.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200 shadow-sm text-sm font-medium">
            {error}
        </div>
      )}

      <ManageLogisticsHeader
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        driverFilter={driverFilter}
        setDriverFilter={setDriverFilter}
        helperFilter={helperFilter}
        setHelperFilter={setHelperFilter}
        onAddManualDispatch={() => setIsAddDialogOpen(true)}
      />

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-800">Dispatch Records</CardTitle>
            <CardDescription>All dispatches matching the current cutoff criteria.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <ManageLogisticsDispatchList
                dispatches={paginatedDispatches}
                isLoading={isLoading}
                onUpdateStaff={updateDispatchStaff}
            />
            
            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/30">
                <div className="text-sm font-medium text-slate-500">
                    Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isLoading}
                        className="shadow-sm"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || isLoading}
                        className="shadow-sm"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>

      <AddManualDispatchDialog 
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSave={addManualDispatch}
      />
    </div>
  );
}
