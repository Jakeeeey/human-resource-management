import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import type { TopsheetUserSummary } from "../type";

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDateStr(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeStr(timeStr: string): string {
  if (!timeStr) return "—";
  const [hStr, mStr] = timeStr.slice(0, 5).split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${mStr}${period}`;
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

export async function exportTopsheetPDF(
  data: TopsheetUserSummary[],
  exportType: "both" | "topsheet" | "reasons",
  dateRangeText: string
) {
  const fileName = `Overtime_Topsheet_${exportType}_${new Date().toISOString().split("T")[0]}.pdf`;

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates().catch((err) => {
        console.warn("Failed to fetch templates, falling back to default:", err);
        return [];
      }),
    ]);

    const templateName =
      templates.find((t: { name: string }) => t.name === "Header")?.name ||
      templates[0]?.name ||
      "Overtime Topsheet";

    const doc = await PdfEngine.generateWithFrame(
      templateName,
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        const pageW = doc.internal.pageSize.getWidth();
        const usableW = pageW - margins.left - margins.right;

        let currentY = startY;

        // --- Topsheet Page ---
        if (exportType === "both" || exportType === "topsheet") {
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("OVERTIME TOPSHEET", margins.left, currentY, { baseline: "top" });
          currentY += 8;

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Period: ${dateRangeText}`, margins.left, currentY, { baseline: "top" });
          doc.setTextColor(0, 0, 0);
          currentY += 10;

          const topsheetBody = data.map((u) => [
            u.employee_name,
            u.department_name || "—",
            formatMinutesToHours(u.total_duration_minutes),
          ]);

          autoTable(doc, {
            startY: currentY,
            head: [["Employee Name", "Department", "Total Approved OT"]],
            body: topsheetBody,
            margin: margins,
            theme: "striped",
            tableWidth: usableW,
            headStyles: {
              fillColor: [41, 128, 185],
              textColor: 255,
              fontSize: 9,
              fontStyle: "bold",
            },
            bodyStyles: { fontSize: 8, valign: "middle" },
            columnStyles: {
              0: { cellWidth: usableW * 0.4 },
              1: { cellWidth: usableW * 0.3 },
              2: { cellWidth: usableW * 0.3, halign: "right" },
            },
            didDrawPage: (dataInfo: { pageNumber: number }) => {
              const h = doc.internal.pageSize.getHeight();
              const w = doc.internal.pageSize.getWidth();
              doc.setFontSize(8);
              doc.setTextColor(150);
              doc.text(`Page ${dataInfo.pageNumber}`, w / 2, h - 5, { align: "center" });
              doc.setTextColor(0);
            },
          });

          currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
        }

        // --- Reasons Page(s) ---
        if (exportType === "both" || exportType === "reasons") {
          // If exporting both, add a new page for reasons
          if (exportType === "both") {
            doc.addPage();
            currentY = margins.top;
          } else {
            // Just printing reasons
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("OVERTIME REASONS", margins.left, currentY, { baseline: "top" });
            currentY += 8;

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(`Period: ${dateRangeText}`, margins.left, currentY, { baseline: "top" });
            doc.setTextColor(0, 0, 0);
            currentY += 10;
          }

          // Generate tables per person
          data.forEach((userSum) => {
            // Only render if they have requests
            if (userSum.requests.length === 0) return;

            const pageH = doc.internal.pageSize.getHeight();
            // Check if we have enough space for the title and at least one table row (approx 25-30 units)
            if (currentY + 30 > pageH - margins.bottom) {
              doc.addPage();
              currentY = margins.top;
            }

            // Add title for the employee
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`Employee: ${userSum.employee_name} (${userSum.department_name || "N/A"})`, margins.left, currentY);
            currentY += 5;

            const reasonsBody = userSum.requests.map((r) => [
              formatDateStr(r.request_date),
              formatTimeStr(r.ot_from),
              formatTimeStr(r.ot_to),
              formatMinutesToHours(r.duration_minutes),
              r.purpose || "—",
            ]);

            autoTable(doc, {
              startY: currentY,
              head: [["Date", "Time In", "Time Out", "Duration", "Purpose"]],
              body: reasonsBody,
              margin: margins,
              theme: "grid",
              tableWidth: usableW,
              headStyles: {
                fillColor: [60, 60, 60],
                textColor: 255,
                fontSize: 8,
                fontStyle: "bold",
              },
              bodyStyles: { fontSize: 8, valign: "middle" },
              columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 20 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: usableW - 85 }, // Remaining width for purpose
              },
              didDrawPage: (dataInfo: { pageNumber: number }) => {
                if (exportType === "reasons") {
                  const h = doc.internal.pageSize.getHeight();
                  const w = doc.internal.pageSize.getWidth();
                  doc.setFontSize(8);
                  doc.setTextColor(150);
                  doc.text(`Page ${dataInfo.pageNumber}`, w / 2, h - 5, { align: "center" });
                  doc.setTextColor(0);
                }
              },
            });

            currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
          });
        }
      }
    );

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF export error:", err);
  }
}
