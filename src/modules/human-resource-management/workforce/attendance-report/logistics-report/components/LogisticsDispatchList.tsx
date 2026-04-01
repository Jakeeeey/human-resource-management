"use client";

import { useRef } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DispatchAttendance, LogisticsReportMeta } from "../type";
import {
  formatDateTimeValue,
  getAttendanceBadgeClass,
  getAttendanceRowClass,
} from "../utils/report";

interface LogisticsDispatchListProps {
  dispatches: DispatchAttendance[];
  meta: LogisticsReportMeta;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startRow: number;
  endRow: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function LogisticsDispatchList({
  dispatches,
  meta,
  isLoading,
  error,
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  startRow,
  endRow,
  onPageChange,
  onPageSizeChange,
}: LogisticsDispatchListProps) {
  const hasNoResults = totalItems === 0;

  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleValueChange = (value: string) => {
    if (value && itemRefs.current[value]) {
      setTimeout(() => {
        itemRefs.current[value]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 150); // slight delay to allow accordion animation to start
    }
  };

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>List of Post Dispatch Plan</CardTitle>
            <CardDescription>
              Range: {meta.startDate} to {meta.endDate}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Present
            </Badge>
            <Badge className="border-red-200 bg-red-50 text-red-700">
              Absent
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : hasNoResults ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
            No post dispatch attendance records were found for the selected date
            range.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>
                Showing {startRow} to {endRow} of {totalItems} dispatch plans
              </span>
              {totalPages > 1 ? (
                <span>
                  Page {currentPage} of {totalPages}
                </span>
              ) : null}
            </div>

            <Accordion
              type="single"
              collapsible
              className="w-full rounded-lg border"
              onValueChange={handleValueChange}
            >
              {dispatches.map((dispatch, index) => {
                const rowNumber = startRow + index;
                const uniqueStaff = dispatch.staff.filter(
                  (staff, idx, self) =>
                    idx ===
                    self.findIndex(
                      (s) =>
                        (s.staffUserId ?? s.staffName) ===
                        (staff.staffUserId ?? staff.staffName),
                    ),
                );

                const itemValue = `${dispatch.dispatchPlanId ?? dispatch.dispatchDocNo}-${index}`;

                return (
                  <div key={itemValue} ref={(el) => { itemRefs.current[itemValue] = el; }}>
                    <AccordionItem
                      value={itemValue}
                      className="px-4 transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/30 border-0"
                    >
                      <AccordionTrigger className="hover:no-underline rounded-lg border-t first:border-0 border-b-0">
                      <div className="grid flex-1 gap-3 text-left md:grid-cols-[60px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            No.
                          </div>
                          <div className="text-sm font-semibold">
                            {rowNumber}.
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Dispatch No
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {dispatch.dispatchDocNo || "N/A"}
                            </span>
                            {dispatch.dispatchStatus ? (
                              <Badge variant="outline">
                                {dispatch.dispatchStatus}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Time of Dispatch
                          </div>
                          <div className="text-sm">
                            {formatDateTimeValue(dispatch.timeOfDispatch)}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Time of Arrival
                          </div>
                          <div className="text-sm">
                            {formatDateTimeValue(dispatch.timeOfArrival)}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="space-y-4 pt-2">
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16">No.</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {uniqueStaff.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="py-6 text-center text-muted-foreground"
                                >
                                  No staff attendance records found for this
                                  dispatch.
                                </TableCell>
                              </TableRow>
                            ) : (
                              uniqueStaff.map((staff, staffIndex) => (
                                <TableRow
                                  key={`${staff.staffUserId ?? staff.staffName}-${staffIndex}`}
                                  className={getAttendanceRowClass(
                                    staff.isPresent,
                                  )}
                                >
                                  <TableCell>{staffIndex + 1}</TableCell>
                                  <TableCell className="whitespace-normal font-medium">
                                    {staff.staffName}
                                  </TableCell>
                                  <TableCell>{staff.staffRole}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={getAttendanceBadgeClass(
                                        staff.isPresent,
                                      )}
                                    >
                                      {staff.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </div>
                );
              })}
            </Accordion>

            {totalPages > 1 ? (
              <div className="pt-4">
                <DataTablePagination
                  pageIndex={currentPage}
                  pageSize={pageSize}
                  rowCount={totalItems}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
