import "jspdf-autotable";
import autoTable               from "jspdf-autotable";
import { PdfEngine }           from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService }  from "@/components/pdf-layout-design/services/pdf-template";
import type { Employee, EmployeeAttendanceRow } from "../hooks/useEmployeeReport";
import { minsToHM }            from "./index";

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [hStr, mStr] = t.slice(0, 5).split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "pm" : "am";
  const hour   = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${mStr}${period}`;
}

function formatDate(ymd: string): string {
  return new Date(ymd + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

async function fetchCompanyData() {
  try {
    const res = await fetch("/api/pdf/company", { credentials: "include" });
    if (!res.ok) return null;
    const result = await res.json();
    return result.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function exportEmployeeHistoryToPDF(
  employee: Employee,
  logs: EmployeeAttendanceRow[],
  fromDate: string,
  toDate: string,
) {
  const fileName = `${employee.user_fname}_${employee.user_lname}_Attendance_${fromDate}_to_${toDate}.pdf`;

  // ── Summary counts ─────────────────────────────────────────────────────────
  const workLogs      = logs.filter(l => l.status !== "Rest Day" && l.status !== "Holiday");
  const daysAttended  = workLogs.filter(l => l.status !== "Absent").length;
  const daysAbsent    = workLogs.filter(l => l.status === "Absent").length;
  const totalWorkMins = workLogs.reduce((s, l) => s + Math.min(l.work_hours, 480), 0);
  const totalOvertMin = workLogs.reduce((s, l) => s + l.overtime, 0);
  const totalLateMins = workLogs.reduce((s, l) => s + l.late, 0);

  const tableData = logs.map(l => [
    formatDate(l.log_date),
    formatTime(l.time_in),
    formatTime(l.lunch_start),
    formatTime(l.lunch_end),
    formatTime(l.break_start),
    formatTime(l.break_end),
    formatTime(l.time_out),
    minsToHM(Math.min(l.work_hours, 480)),
    l.overtime > 0 ? minsToHM(l.overtime) : "—",
    l.late > 0     ? minsToHM(l.late)     : "—",
    l.status === "On Time" || l.status === "Late" ? "Present" : l.status,
  ]);

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);

    const templateName =
      templates.find((t: { name: string }) => t.name === "Header")?.name ||
      templates[0]?.name ||
      "Employee Attendance Report";

    const doc = await PdfEngine.generateWithFrame(
      templateName, companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        const pageW   = doc.internal.pageSize.getWidth();
        const usableW = pageW - margins.left - margins.right;

        // ── Title block ──────────────────────────────────────────────────────
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text(
          `${employee.user_fname} ${employee.user_lname}`,
          margins.left, startY, { baseline: "top" },
        );

        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(
          `${employee.user_position} | ${employee.department_name}`,
          margins.left, startY + 7, { baseline: "top" },
        );
        doc.text(
          `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`,
          margins.left, startY + 13, { baseline: "top" },
        );

        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text(
          `Days Attended: ${daysAttended}   |   Days Absent: ${daysAbsent}   |   Work: ${minsToHM(totalWorkMins)}   |   OT: ${minsToHM(totalOvertMin)}   |   Late: ${minsToHM(totalLateMins)}`,
          margins.left, startY + 20, { baseline: "top" },
        );
        doc.setTextColor(0, 0, 0);

        // ── Column widths summing to usableW ─────────────────────────────────
        const colDate       = 22;
        const colTimeIn     = 17;
        const colLunchStart = 20;
        const colLunchEnd   = 17;
        const colBreakStart = 20;
        const colBreakEnd   = 17;
        const colTimeOut    = 17;
        const colWorkHrs    = 17;
        const colOT         = 13;
        const colLate       = 13;
        const colStatus     = usableW - colDate - colTimeIn - colLunchStart - colLunchEnd
                              - colBreakStart - colBreakEnd - colTimeOut - colWorkHrs - colOT - colLate;

        // ── Table ─────────────────────────────────────────────────────────────
        autoTable(doc, {
          startY: startY + 27,
          head: [["Date", "Time In", "Lunch Start", "Lunch End", "Break Start", "Break End", "Time Out", "Work Hrs", "OT", "Late", "Status"]],
          body: tableData,
          margin: margins,
          theme: "striped",
          tableWidth: usableW,
          headStyles: {
            fillColor: [41, 128, 185], textColor: 255,
            fontSize: 8, fontStyle: "bold",
            halign: "center", valign: "middle", cellPadding: 1.5,
          },
          bodyStyles: { fontSize: 7.5, valign: "middle", cellPadding: 1.5 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0:  { cellWidth: colDate,       halign: "center" },
            1:  { cellWidth: colTimeIn,     halign: "center" },
            2:  { cellWidth: colLunchStart, halign: "center" },
            3:  { cellWidth: colLunchEnd,   halign: "center" },
            4:  { cellWidth: colBreakStart, halign: "center" },
            5:  { cellWidth: colBreakEnd,   halign: "center" },
            6:  { cellWidth: colTimeOut,    halign: "center" },
            7:  { cellWidth: colWorkHrs,    halign: "center" },
            8:  { cellWidth: colOT,         halign: "center" },
            9:  { cellWidth: colLate,       halign: "center" },
            10: { cellWidth: colStatus,     halign: "center" },
          },
          didDrawPage: (data: { pageNumber: number }) => {
            const h = doc.internal.pageSize.getHeight();
            const w = doc.internal.pageSize.getWidth();
            doc.setFontSize(8); doc.setTextColor(150);
            doc.text(`Page ${data.pageNumber}`, w / 2, h - 5, { align: "center" });
            doc.setTextColor(0);
          },
        });
      },
    );

    const blob = doc.output("blob");
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF export error:", err);
  }
}