"use client";

import React from "react";
import type { DepartmentMatrixData, TotalHoursReportFilters } from "../type";
import { formatReportDate, formatPrintTimestamp } from "./printSummaryReport";

interface PrintableSummaryReportProps {
  matrix: DepartmentMatrixData | null;
  filters: TotalHoursReportFilters;
  departments: Array<{ department_id: number; department_name: string }>;
  hoursOnly?: boolean;
  includeTotals?: boolean;
}

export function PrintableSummaryReport({
  matrix,
  filters,
  departments,
  hoursOnly = false,
  includeTotals = false,
}: PrintableSummaryReportProps) {
  if (!matrix || matrix.employees.length === 0) return null;

  const rangeStr = `${formatReportDate(filters.dateFrom)} — ${formatReportDate(filters.dateTo)}`;
  const searchStr = filters.searchQuery ? filters.searchQuery : "—";
  const hoursOnlyStr = hoursOnly ? "Yes" : "No";
  const perDayStr = hoursOnly ? "T" : "T, L, O, U";
  const printedStr = formatPrintTimestamp();

  const selectedDept = filters.departmentId
    ? departments.find((d) => d.department_id === filters.departmentId)
    : null;
  const departmentStr = selectedDept ? selectedDept.department_name : "All";

  const dates = matrix.dates;
  const employees = matrix.employees;

  // Strictly chunk dates into weeks (max 7 days per chunk/page)
  const CHUNK_SIZE = 7;
  const dateChunks: Array<typeof matrix.dates> = [];
  if (dates.length === 0) {
    dateChunks.push([]);
  } else {
    for (let i = 0; i < dates.length; i += CHUNK_SIZE) {
      dateChunks.push(dates.slice(i, i + CHUNK_SIZE));
    }
  }

  const totalChunks = dateChunks.length;

  return (
    <div
      id="summary-reports-print"
      className="hidden print:block w-full bg-white text-black p-0 m-0"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          #summary-reports-print, #summary-reports-print * {
            visibility: visible !important;
          }
          #summary-reports-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
          }
          .print-chunk-page {
            width: 100% !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          .print-chunk-page:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          table.print-matrix-table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          table.print-matrix-table th, table.print-matrix-table td {
            border: 1px solid #d1d5db !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>

      {dateChunks.map((chunkDates, chunkIndex) => {
        const isLastChunk = chunkIndex === totalChunks - 1;
        const chunkRangeStr =
          chunkDates.length > 0
            ? `${formatReportDate(chunkDates[0]?.date)} — ${formatReportDate(chunkDates[chunkDates.length - 1]?.date)}`
            : rangeStr;

        return (
          <div
            key={`chunk-${chunkIndex}`}
            className="print-chunk-page w-full mb-6 print:mb-0"
            style={{
              pageBreakAfter: chunkIndex < totalChunks - 1 ? "always" : "auto",
              breakAfter: chunkIndex < totalChunks - 1 ? "page" : "auto",
            }}
          >
            {/* Header Container */}
            <div className="flex justify-between items-start mb-2.5 pb-0.5">
              <div>
                <h1 className="text-[15px] font-bold text-black m-0 mb-1 tracking-tight">
                  Summary Reports
                </h1>
                <div className="text-[9.5px] leading-snug text-neutral-900">
                  <span className="font-bold inline-block min-w-[65px]">Range:</span>
                  <span>
                    {rangeStr}
                    {totalChunks > 1 && (
                      <span className="ml-1.5 font-bold">
                        (Week {chunkIndex + 1} of {totalChunks}: {chunkRangeStr})
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-[9.5px] leading-snug text-neutral-900">
                  <span className="font-bold inline-block min-w-[65px]">Search:</span>
                  <span>{searchStr}</span>
                </div>
                <div className="text-[9.5px] leading-snug text-neutral-900">
                  <span className="font-bold inline-block min-w-[65px]">Hours only:</span>
                  <span>{hoursOnlyStr}</span>
                </div>
                <div className="text-[9.5px] leading-snug text-neutral-900">
                  <span className="font-bold inline-block min-w-[65px]">Printed:</span>
                  <span>{printedStr}</span>
                </div>
              </div>

              <div className="text-left text-[9.5px] leading-snug text-neutral-900 pr-5">
                <div>
                  <span className="font-bold inline-block min-w-[70px]">Department:</span>
                  <span>{departmentStr}</span>
                </div>
                <div>
                  <span className="font-bold inline-block min-w-[70px]">Per Day:</span>
                  <span>{perDayStr}</span>
                </div>
                {totalChunks > 1 && (
                  <div className="mt-0.5">
                    <span className="font-bold inline-block min-w-[70px]">Page:</span>
                    <span className="font-bold">{chunkIndex + 1} of {totalChunks}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <table className="print-matrix-table w-full border-collapse border border-gray-300 text-[9px] mt-0.5">
              <thead>
                <tr>
                  <th
                    rowSpan={hoursOnly ? 1 : 2}
                    className="border border-gray-300 p-1 text-center font-bold text-[9.5px] text-black w-[165px] align-middle bg-white"
                  >
                    Name
                  </th>
                  {chunkDates.map((d) => (
                    <th
                      key={d.date}
                      colSpan={hoursOnly ? 1 : 4}
                      className="border border-gray-300 py-1 px-0.5 text-center font-bold text-[9.5px] text-black bg-white"
                    >
                      {d.displayHeader}
                    </th>
                  ))}
                  {isLastChunk && includeTotals && (
                    <th
                      colSpan={hoursOnly ? 1 : 4}
                      className="border border-gray-300 py-1 px-0.5 text-center font-bold text-[9.5px] text-black bg-gray-50"
                    >
                      Period Summary
                    </th>
                  )}
                </tr>

                {!hoursOnly && (
                  <tr>
                    {chunkDates.map((d) => (
                      <React.Fragment key={`sub-${d.date}`}>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-white">
                          T
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-white">
                          L
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-white">
                          O
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-white">
                          U
                        </th>
                      </React.Fragment>
                    ))}
                    {isLastChunk && includeTotals && (
                      <>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-11 text-black bg-gray-50">
                          Total
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-gray-50">
                          Late
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-gray-50">
                          OT
                        </th>
                        <th className="border border-gray-300 py-0.5 px-0.5 text-center font-bold text-[8.5px] w-10 text-black bg-gray-50">
                          UT
                        </th>
                      </>
                    )}
                  </tr>
                )}
              </thead>

              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.user_id}>
                    <td className="border border-gray-300 py-1 px-1 text-center align-middle">
                      <div className="font-bold text-[9.5px] text-neutral-900 leading-tight">
                        {emp.employee_name}
                      </div>
                      <div className="text-[8px] text-neutral-600 mt-0.5 leading-tight">
                        {emp.employee_position || emp.department_name}
                      </div>
                    </td>

                    {chunkDates.map((d) => {
                      const day = emp.days[d.date];
                      const isAbsent = !day || day.isAbsent;

                      if (hoursOnly) {
                        return (
                          <td
                            key={`day-${emp.user_id}-${d.date}`}
                            className="border border-gray-300 py-1 px-0.5 text-center align-middle"
                          >
                            {isAbsent ? (
                              <span className="text-neutral-500 text-[8.5px]">A</span>
                            ) : (
                              <span className="text-[8.5px] text-neutral-900 whitespace-nowrap">
                                {day.work_formatted}
                              </span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <React.Fragment key={`day-${emp.user_id}-${d.date}`}>
                          <td className="border border-gray-300 py-1 px-0.5 text-center align-middle">
                            {isAbsent ? (
                              <span className="text-neutral-500 text-[8.5px]">A</span>
                            ) : (
                              <span className="text-[8.5px] text-neutral-900 whitespace-nowrap">
                                {day.work_formatted}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 py-1 px-0.5 text-center align-middle">
                            {isAbsent ? (
                              <span className="text-neutral-500 text-[8.5px]">A</span>
                            ) : (
                              <span className="text-[8.5px] text-neutral-900 whitespace-nowrap">
                                {day.late_formatted}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 py-1 px-0.5 text-center align-middle">
                            {isAbsent ? (
                              <span className="text-neutral-500 text-[8.5px]">A</span>
                            ) : (
                              <span className="text-[8.5px] text-neutral-900 whitespace-nowrap">
                                {day.overtime_formatted}
                              </span>
                            )}
                          </td>
                          <td className="border border-gray-300 py-1 px-0.5 text-center align-middle">
                            {isAbsent ? (
                              <span className="text-neutral-500 text-[8.5px]">A</span>
                            ) : (
                              <span className="text-[8.5px] text-neutral-900 whitespace-nowrap">
                                {day.undertime_formatted}
                              </span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {isLastChunk && includeTotals && (
                      <>
                        <td className="border border-gray-300 py-1 px-0.5 text-center align-middle font-bold text-[8.5px] bg-neutral-50">
                          {Math.floor(emp.totals.total_work_minutes / 60)}h{" "}
                          {emp.totals.total_work_minutes % 60}m
                        </td>
                        <td className="border border-gray-300 py-1 px-0.5 text-center align-middle text-[8.5px] bg-neutral-50">
                          {Math.floor(emp.totals.total_late_minutes / 60)}h{" "}
                          {emp.totals.total_late_minutes % 60}m
                        </td>
                        <td className="border border-gray-300 py-1 px-0.5 text-center align-middle text-[8.5px] bg-neutral-50">
                          {Math.floor(emp.totals.total_overtime_minutes / 60)}h{" "}
                          {emp.totals.total_overtime_minutes % 60}m
                        </td>
                        <td className="border border-gray-300 py-1 px-0.5 text-center align-middle text-[8.5px] bg-neutral-50">
                          {Math.floor(emp.totals.total_undertime_minutes / 60)}h{" "}
                          {emp.totals.total_undertime_minutes % 60}m
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
