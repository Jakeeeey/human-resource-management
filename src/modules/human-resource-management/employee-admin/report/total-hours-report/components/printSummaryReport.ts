import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DepartmentMatrixData, TotalHoursReportFilters } from "../type";

export function formatReportDate(dateVal: Date | string | undefined): string {
  if (!dateVal) return "—";
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "—";
    return dateVal.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  try {
    const [year, month, day] = dateVal.split("-").map(Number);
    if (!year || !month || !day) return dateVal;
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

export function formatPrintTimestamp(): string {
  const d = new Date();
  const datePart = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} ${timePart}`;
}

export interface PrintReportOptions {
  matrix: DepartmentMatrixData;
  filters: TotalHoursReportFilters;
  departments: Array<{ department_id: number; department_name: string }>;
  hoursOnly?: boolean;
  includeTotals?: boolean;
}

export function generateSummaryReportPrintHtml({
  matrix,
  filters,
  departments,
  hoursOnly = false,
  includeTotals = false,
}: PrintReportOptions): string {
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

  const chunksHtml = dateChunks
    .map((chunkDates, chunkIndex) => {
      const isLastChunk = chunkIndex === totalChunks - 1;
      const chunkRangeStr =
        chunkDates.length > 0
          ? `${formatReportDate(chunkDates[0]?.date)} — ${formatReportDate(chunkDates[chunkDates.length - 1]?.date)}`
          : rangeStr;

      // Build table headers for this 1-week chunk
      let theadHtml = "";
      if (hoursOnly) {
        theadHtml = `
          <thead>
            <tr>
              <th style="padding: 6px 8px; text-align: center; width: 180px;">Name</th>
              ${chunkDates.map((d) => `<th style="padding: 6px 4px; text-align: center;">${d.displayHeader}</th>`).join("")}
              ${isLastChunk && includeTotals ? `<th style="padding: 6px 4px; text-align: center;">Total Work</th>` : ""}
            </tr>
          </thead>
        `;
      } else {
        theadHtml = `
          <thead>
            <tr>
              <th rowspan="2" style="padding: 6px 8px; text-align: center; width: 180px; vertical-align: middle;">Name</th>
              ${chunkDates.map((d) => `<th colspan="4" style="padding: 6px 4px; text-align: center;">${d.displayHeader}</th>`).join("")}
              ${
                isLastChunk && includeTotals
                  ? `<th colspan="4" style="padding: 6px 4px; text-align: center; background: #f3f4f6;">Period Summary</th>`
                  : ""
              }
            </tr>
            <tr>
              ${chunkDates
                .map(
                  () => `
                <th class="sub-th">T</th>
                <th class="sub-th">L</th>
                <th class="sub-th">O</th>
                <th class="sub-th">U</th>
              `
                )
                .join("")}
              ${
                isLastChunk && includeTotals
                  ? `
                <th class="sub-th" style="background: #f3f4f6;">Total</th>
                <th class="sub-th" style="background: #f3f4f6;">Late</th>
                <th class="sub-th" style="background: #f3f4f6;">OT</th>
                <th class="sub-th" style="background: #f3f4f6;">UT</th>
              `
                  : ""
              }
            </tr>
          </thead>
        `;
      }

      // Build table rows for this 1-week chunk (restating employees)
      const tbodyHtml = employees
        .map((emp) => {
          let rowCells = "";

          if (hoursOnly) {
            rowCells = chunkDates
              .map((d) => {
                const day = emp.days[d.date];
                if (!day || day.isAbsent) {
                  return `<td class="cell-absent">A</td>`;
                }
                return `<td class="cell-val">${day.work_formatted}</td>`;
              })
              .join("");

            if (isLastChunk && includeTotals) {
              const totWorkH = Math.floor(emp.totals.total_work_minutes / 60);
              const totWorkM = emp.totals.total_work_minutes % 60;
              rowCells += `<td class="cell-val" style="font-weight: 600;">${totWorkH}h ${totWorkM}m</td>`;
            }
          } else {
            rowCells = chunkDates
              .map((d) => {
                const day = emp.days[d.date];
                if (!day || day.isAbsent) {
                  return `
                    <td class="cell-absent">A</td>
                    <td class="cell-absent">A</td>
                    <td class="cell-absent">A</td>
                    <td class="cell-absent">A</td>
                  `;
                }
                return `
                  <td class="cell-val">${day.work_formatted}</td>
                  <td class="cell-val">${day.late_formatted}</td>
                  <td class="cell-val">${day.overtime_formatted}</td>
                  <td class="cell-val">${day.undertime_formatted}</td>
                `;
              })
              .join("");

            if (isLastChunk && includeTotals) {
              const totWorkH = Math.floor(emp.totals.total_work_minutes / 60);
              const totWorkM = emp.totals.total_work_minutes % 60;
              const totLateH = Math.floor(emp.totals.total_late_minutes / 60);
              const totLateM = emp.totals.total_late_minutes % 60;
              const totOTH = Math.floor(emp.totals.total_overtime_minutes / 60);
              const totOTM = emp.totals.total_overtime_minutes % 60;
              const totUTH = Math.floor(emp.totals.total_undertime_minutes / 60);
              const totUTM = emp.totals.total_undertime_minutes % 60;

              rowCells += `
                <td class="cell-val" style="font-weight: 600; background: #fafafa;">${totWorkH}h ${totWorkM}m</td>
                <td class="cell-val" style="background: #fafafa;">${totLateH}h ${totLateM}m</td>
                <td class="cell-val" style="background: #fafafa;">${totOTH}h ${totOTM}m</td>
                <td class="cell-val" style="background: #fafafa;">${totUTH}h ${totUTM}m</td>
              `;
            }
          }

          return `
            <tr>
              <td class="emp-name-cell">
                <div class="emp-name">${emp.employee_name}</div>
                <div class="emp-pos">${emp.employee_position || emp.department_name}</div>
              </td>
              ${rowCells}
            </tr>
          `;
        })
        .join("");

      return `
        <div class="report-chunk-page">
          <div class="header-container">
            <div class="header-left">
              <h1>Summary Reports</h1>
              <div class="meta-row">
                <span class="meta-label">Range:</span>
                <span class="meta-value">${rangeStr}${totalChunks > 1 ? ` &nbsp;<strong>(Week ${chunkIndex + 1} of ${totalChunks}: ${chunkRangeStr})</strong>` : ""}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Search:</span>
                <span class="meta-value">${searchStr}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Hours only:</span>
                <span class="meta-value">${hoursOnlyStr}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Printed:</span>
                <span class="meta-value">${printedStr}</span>
              </div>
            </div>
            <div class="header-right">
              <div class="meta-row">
                <span class="meta-label">Department:</span>
                <span class="meta-value">${departmentStr}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Per Day:</span>
                <span class="meta-value">${perDayStr}</span>
              </div>
              ${
                totalChunks > 1
                  ? `
                <div class="meta-row" style="margin-top: 4px;">
                  <span class="meta-label">Page:</span>
                  <span class="meta-value" style="font-weight: 700;">${chunkIndex + 1} of ${totalChunks}</span>
                </div>
                `
                  : ""
              }
            </div>
          </div>

          <table class="report-table">
            ${theadHtml}
            <tbody>
              ${tbodyHtml}
            </tbody>
          </table>
        </div>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Summary Reports</title>
  <style>
    @page {
      size: landscape;
      margin: 10mm 10mm 10mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10px;
    }
    .report-chunk-page {
      width: 100%;
      box-sizing: border-box;
    }
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      padding-bottom: 2px;
    }
    .header-left h1 {
      font-size: 15px;
      font-weight: 700;
      margin: 0 0 4px 0;
      color: #000000;
      letter-spacing: -0.01em;
    }
    .meta-row {
      margin: 1.5px 0;
      font-size: 9.5px;
      line-height: 1.4;
      color: #111827;
    }
    .meta-label {
      font-weight: 700;
      color: #111827;
      display: inline-block;
      min-width: 65px;
    }
    .meta-value {
      color: #111827;
    }
    .header-right {
      text-align: left;
      font-size: 9.5px;
      line-height: 1.4;
      padding-right: 20px;
    }
    .header-right .meta-label {
      min-width: 70px;
    }
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #d1d5db;
      font-size: 9px;
      margin-top: 3px;
    }
    table.report-table th, table.report-table td {
      border: 1px solid #d1d5db;
      text-align: center;
      vertical-align: middle;
      padding: 3.5px 2px;
    }
    table.report-table th {
      background-color: #ffffff;
      font-weight: 700;
      color: #000000;
      font-size: 9.5px;
    }
    table.report-table th.sub-th {
      font-weight: 700;
      font-size: 8.5px;
      padding: 3px 1.5px;
      width: 40px;
    }
    table.report-table td.emp-name-cell {
      padding: 4px 4px;
      text-align: center;
      width: 165px;
      min-width: 145px;
    }
    .emp-name {
      font-weight: 700;
      font-size: 9.5px;
      color: #111827;
      line-height: 1.25;
    }
    .emp-pos {
      font-size: 8px;
      color: #4b5563;
      margin-top: 1.5px;
      line-height: 1.15;
    }
    .cell-val {
      font-size: 8.5px;
      color: #111827;
      white-space: nowrap;
    }
    .cell-absent {
      font-size: 8.5px;
      color: #4b5563;
    }
    @media print {
      .screen-actions-bar {
        display: none !important;
      }
      .report-chunk-page {
        page-break-inside: auto;
        break-inside: auto;
      }
      .report-chunk-page:not(:last-child) {
        page-break-after: always !important;
        break-after: page !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
      }
    }
    @media screen {
      body {
        padding: 20px;
        background-color: #f3f4f6;
      }
      .report-chunk-page:not(:last-child) {
        border-bottom: 2px dashed #9ca3af;
        padding-bottom: 32px;
        margin-bottom: 32px;
      }
      .screen-actions-bar {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        gap: 8px;
        z-index: 99999;
        background: #ffffff;
        padding: 6px 10px;
        border-radius: 9999px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        border: 1px solid #d1d5db;
      }
      .action-btn {
        cursor: pointer;
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 9999px;
        border: none;
        transition: all 0.15s ease;
      }
      .action-btn-close {
        background: #dc2626;
        color: #ffffff;
      }
      .action-btn-close:hover {
        background: #b91c1c;
      }
      .action-btn-print {
        background: #2563eb;
        color: #ffffff;
      }
      .action-btn-print:hover {
        background: #1d4ed8;
      }
      .preview-wrapper {
        max-width: 1380px;
        margin: 0 auto;
        background: #ffffff;
        padding: 24px;
        border-radius: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
    }
  </style>
</head>
<body>
  <div class="screen-actions-bar">
    <button id="btnPrintAgain" class="action-btn action-btn-print" type="button" onclick="window.print()">Print</button>
    <button id="btnCloseTab" class="action-btn action-btn-close" type="button" onclick="window.close()">✕ Close Tab</button>
  </div>

  <div class="preview-wrapper">
    ${chunksHtml}
  </div>

  <script>
    // Explicit click listeners
    var btnClose = document.getElementById("btnCloseTab");
    if (btnClose) {
      btnClose.addEventListener("click", function(e) {
        e.preventDefault();
        window.close();
      });
    }

    var btnPrint = document.getElementById("btnPrintAgain");
    if (btnPrint) {
      btnPrint.addEventListener("click", function(e) {
        e.preventDefault();
        window.print();
      });
    }
  </script>
</body>
</html>`;
}

export function openSummaryReportPrintWindow(options: PrintReportOptions) {
  const htmlContent = generateSummaryReportPrintHtml(options);
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    // Popup was blocked by browser; trigger window.print directly
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Allow styles to finish rendering before print preview opens.
  // Note: We DO NOT aggressively auto-close the window with a timer,
  // as closing the window prematurely while the browser spooler is rasterizing
  // will corrupt or cancel the PDF generation.
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}

/**
 * Generates and automatically downloads the Total Hours Report as a clean,
 * vector PDF document using jsPDF and jspdf-autotable.
 * Does NOT trigger any browser print preview dialog.
 */
export async function downloadTotalHoursPdf({
  matrix,
  filters,
  departments,
  hoursOnly = false,
  includeTotals = false,
}: PrintReportOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

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

  // Chunk dates into weeks (max 7 days per chunk/page)
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
  const PW = doc.internal.pageSize.getWidth(); // ~841.89 pt
  const margin = 24;

  dateChunks.forEach((chunkDates, chunkIndex) => {
    if (chunkIndex > 0) {
      doc.addPage("a4", "landscape");
    }

    const isLastChunk = chunkIndex === totalChunks - 1;
    const chunkRangeStr =
      chunkDates.length > 0
        ? `${formatReportDate(chunkDates[0]?.date)} — ${formatReportDate(chunkDates[chunkDates.length - 1]?.date)}`
        : rangeStr;

    // Draw Chunk Page Header
    let currentY = margin + 14;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text("Summary Reports", margin, currentY);

    currentY += 14;

    // Metadata Grid
    doc.setFontSize(8.5);
    const leftColX = margin;
    const rightColX = PW - margin - 220;

    // Row 1: Range & Department
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("Range:", leftColX, currentY);
    doc.setFont("helvetica", "normal");
    const weekSuffix =
      totalChunks > 1
        ? ` (Week ${chunkIndex + 1} of ${totalChunks}: ${chunkRangeStr})`
        : "";
    doc.text(`${rangeStr}${weekSuffix}`, leftColX + 50, currentY);

    doc.setFont("helvetica", "bold");
    doc.text("Department:", rightColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(departmentStr, rightColX + 65, currentY);

    currentY += 12;

    // Row 2: Search & Per Day
    doc.setFont("helvetica", "bold");
    doc.text("Search:", leftColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(searchStr, leftColX + 50, currentY);

    doc.setFont("helvetica", "bold");
    doc.text("Per Day:", rightColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(perDayStr, rightColX + 65, currentY);

    currentY += 12;

    // Row 3: Hours only & Page
    doc.setFont("helvetica", "bold");
    doc.text("Hours only:", leftColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(hoursOnlyStr, leftColX + 50, currentY);

    if (totalChunks > 1) {
      doc.setFont("helvetica", "bold");
      doc.text("Page:", rightColX, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(`${chunkIndex + 1} of ${totalChunks}`, rightColX + 65, currentY);
    }

    currentY += 12;

    // Row 4: Printed timestamp
    doc.setFont("helvetica", "bold");
    doc.text("Printed:", leftColX, currentY);
    doc.setFont("helvetica", "normal");
    doc.text(printedStr, leftColX + 50, currentY);

    currentY += 14;

    // Build Table Head & Body for autoTable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tableHead: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tableBody: any[] = [];

    if (hoursOnly) {
      tableHead = [
        [
          {
            content: "Name",
            styles: { halign: "center", fontStyle: "bold", valign: "middle" },
          },
          ...chunkDates.map((d) => ({
            content: d.displayHeader,
            styles: { halign: "center", fontStyle: "bold" },
          })),
          ...(isLastChunk && includeTotals
            ? [
                {
                  content: "Total Work",
                  styles: {
                    halign: "center",
                    fontStyle: "bold",
                    fillColor: [243, 244, 246],
                  },
                },
              ]
            : []),
        ],
      ];

      tableBody = employees.map((emp) => {
        const empNameAndPos = emp.employee_position
          ? `${emp.employee_name}\n${emp.employee_position}`
          : emp.employee_name;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowCells: any[] = [
          { content: empNameAndPos, styles: { halign: "left" } },
        ];

        chunkDates.forEach((d) => {
          const day = emp.days[d.date];
          if (!day || day.isAbsent) {
            rowCells.push({
              content: "A",
              styles: { halign: "center", textColor: [107, 114, 128] },
            });
          } else {
            rowCells.push({
              content: day.work_formatted,
              styles: { halign: "center" },
            });
          }
        });

        if (isLastChunk && includeTotals) {
          const totWorkH = Math.floor(emp.totals.total_work_minutes / 60);
          const totWorkM = emp.totals.total_work_minutes % 60;
          rowCells.push({
            content: `${totWorkH}h ${totWorkM}m`,
            styles: {
              halign: "center",
              fontStyle: "bold",
              fillColor: [249, 250, 251],
            },
          });
        }

        return rowCells;
      });
    } else {
      // Full metrics: 2-row header
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headRow1: any[] = [
        {
          content: "Name",
          rowSpan: 2,
          styles: { halign: "center", valign: "middle", fontStyle: "bold" },
        },
        ...chunkDates.map((d) => ({
          content: d.displayHeader,
          colSpan: 4,
          styles: { halign: "center", fontStyle: "bold" },
        })),
        ...(isLastChunk && includeTotals
          ? [
              {
                content: "Period Summary",
                colSpan: 4,
                styles: {
                  halign: "center",
                  fontStyle: "bold",
                  fillColor: [243, 244, 246],
                },
              },
            ]
          : []),
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headRow2: any[] = [
        ...chunkDates.flatMap(() => [
          { content: "T", styles: { halign: "center", fontStyle: "bold" } },
          { content: "L", styles: { halign: "center", fontStyle: "bold" } },
          { content: "O", styles: { halign: "center", fontStyle: "bold" } },
          { content: "U", styles: { halign: "center", fontStyle: "bold" } },
        ]),
        ...(isLastChunk && includeTotals
          ? [
              {
                content: "Total",
                styles: {
                  halign: "center",
                  fontStyle: "bold",
                  fillColor: [243, 244, 246],
                },
              },
              {
                content: "Late",
                styles: {
                  halign: "center",
                  fontStyle: "bold",
                  fillColor: [243, 244, 246],
                },
              },
              {
                content: "OT",
                styles: {
                  halign: "center",
                  fontStyle: "bold",
                  fillColor: [243, 244, 246],
                },
              },
              {
                content: "UT",
                styles: {
                  halign: "center",
                  fontStyle: "bold",
                  fillColor: [243, 244, 246],
                },
              },
            ]
          : []),
      ];

      tableHead = [headRow1, headRow2];

      tableBody = employees.map((emp) => {
        const empNameAndPos = emp.employee_position
          ? `${emp.employee_name}\n${emp.employee_position}`
          : emp.employee_name;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowCells: any[] = [
          { content: empNameAndPos, styles: { halign: "left" } },
        ];

        chunkDates.forEach((d) => {
          const day = emp.days[d.date];
          if (!day || day.isAbsent) {
            rowCells.push(
              {
                content: "A",
                styles: { halign: "center", textColor: [107, 114, 128] },
              },
              {
                content: "A",
                styles: { halign: "center", textColor: [107, 114, 128] },
              },
              {
                content: "A",
                styles: { halign: "center", textColor: [107, 114, 128] },
              },
              {
                content: "A",
                styles: { halign: "center", textColor: [107, 114, 128] },
              }
            );
          } else {
            rowCells.push(
              { content: day.work_formatted, styles: { halign: "center" } },
              { content: day.late_formatted, styles: { halign: "center" } },
              { content: day.overtime_formatted, styles: { halign: "center" } },
              { content: day.undertime_formatted, styles: { halign: "center" } }
            );
          }
        });

        if (isLastChunk && includeTotals) {
          const totWorkH = Math.floor(emp.totals.total_work_minutes / 60);
          const totWorkM = emp.totals.total_work_minutes % 60;
          const totLateH = Math.floor(emp.totals.total_late_minutes / 60);
          const totLateM = emp.totals.total_late_minutes % 60;
          const totOTH = Math.floor(emp.totals.total_overtime_minutes / 60);
          const totOTM = emp.totals.total_overtime_minutes % 60;
          const totUTH = Math.floor(emp.totals.total_undertime_minutes / 60);
          const totUTM = emp.totals.total_undertime_minutes % 60;

          rowCells.push(
            {
              content: `${totWorkH}h ${totWorkM}m`,
              styles: {
                halign: "center",
                fontStyle: "bold",
                fillColor: [249, 250, 251],
              },
            },
            {
              content: `${totLateH}h ${totLateM}m`,
              styles: { halign: "center", fillColor: [249, 250, 251] },
            },
            {
              content: `${totOTH}h ${totOTM}m`,
              styles: { halign: "center", fillColor: [249, 250, 251] },
            },
            {
              content: `${totUTH}h ${totUTM}m`,
              styles: { halign: "center", fillColor: [249, 250, 251] },
            }
          );
        }

        return rowCells;
      });
    }

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: tableBody,
      theme: "grid",
      styles: {
        fontSize: hoursOnly ? 7.5 : 6.5,
        cellPadding: hoursOnly ? 3 : 2,
        textColor: [17, 24, 39],
        lineColor: [209, 213, 219],
        lineWidth: 0.5,
        font: "helvetica",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineWidth: 0.5,
        lineColor: [209, 213, 219],
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [253, 253, 254],
      },
      columnStyles: {
        0: {
          cellWidth: hoursOnly ? 130 : 105,
          halign: "left",
        },
      },
      margin: { left: margin, right: margin, top: margin, bottom: margin },
      pageBreak: "auto",
      showHead: "everyPage",
    });
  });

  // Generate safe filename and trigger direct download
  const fromClean = filters.dateFrom
    ? filters.dateFrom instanceof Date
      ? filters.dateFrom.toISOString().slice(0, 10)
      : String(filters.dateFrom).slice(0, 10)
    : "start";
  const toClean = filters.dateTo
    ? filters.dateTo instanceof Date
      ? filters.dateTo.toISOString().slice(0, 10)
      : String(filters.dateTo).slice(0, 10)
    : "end";
  const deptClean = selectedDept
    ? selectedDept.department_name.replace(/[^a-zA-Z0-9_-]/g, "_")
    : "All_Departments";

  const fileName = `Total_Hours_Report_${deptClean}_${fromClean}_to_${toClean}.pdf`;
  doc.save(fileName);
}
