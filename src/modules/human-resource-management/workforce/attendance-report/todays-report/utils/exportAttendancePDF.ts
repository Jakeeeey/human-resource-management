import "jspdf-autotable";
import autoTable               from "jspdf-autotable";
import { PdfEngine }           from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService }  from "@/components/pdf-layout-design/services/pdf-template";

type AttendanceRecord = Record<string, unknown>;

function formatTime(t: string | null): string {
  if (!t) return "—";
  const [hStr, mStr] = t.slice(0, 5).split(":");
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

export async function exportAttendancePDF(records: AttendanceRecord[]) {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fileName     = `Attendance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
  const presentCount = records.filter((r) => r.presentStatus === "Present").length;
  const absentCount  = records.filter((r) => r.presentStatus === "Absent").length;

  const tableData = records.map((r) => [
    `${r.user_fname} ${r.user_lname}`,
    String(r.user_department ?? "—"),
    String(r.user_position   ?? "—"),
    formatTime(r.time_in  as string | null),
    formatTime(r.time_out as string | null),
    String(r.punctuality  ?? "—"),
    String(r.presentStatus ?? "—"),
  ]);

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);

    const templateName =
      templates.find((t: { name: string }) => t.name === "Header")?.name ||
      templates[0]?.name ||
      "Today Attendance Report";

    const doc = await PdfEngine.generateWithFrame(
      templateName, companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        const pageW   = doc.internal.pageSize.getWidth();
        const usableW = pageW - margins.left - margins.right;

        // ── Title block ──────────────────────────────────────────────────────
        doc.setFontSize(14); doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text("TODAY'S ATTENDANCE REPORT", margins.left, startY, { baseline: "top" });

        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${today}`, margins.left, startY + 8, { baseline: "top" });

        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.setTextColor(20, 20, 20);
        doc.text(
          `Total: ${records.length}   |   Present: ${presentCount}   |   Absent: ${absentCount}`,
          margins.left, startY + 15, { baseline: "top" },
        );
        doc.setTextColor(0, 0, 0);

        // ── Column widths summing to usableW ─────────────────────────────────
        const colName        = 40;
        const colDept        = 28;
        const colPosition    = 35;
        const colTimeIn      = 17;
        const colTimeOut     = 17;
        const colPunctuality = 24;
        const colStatus      = usableW - colName - colDept - colPosition
                               - colTimeIn - colTimeOut - colPunctuality;

        // ── Table ─────────────────────────────────────────────────────────────
        autoTable(doc, {
          startY: startY + 23,
          head: [["Employee Name", "Department", "Position", "Time In", "Time Out", "Punctuality", "Status"]],
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
            0: { cellWidth: colName,        halign: "left"   },
            1: { cellWidth: colDept,        halign: "left"   },
            2: { cellWidth: colPosition,    halign: "left"   },
            3: { cellWidth: colTimeIn,      halign: "center" },
            4: { cellWidth: colTimeOut,     halign: "center" },
            5: { cellWidth: colPunctuality, halign: "center" },
            6: { cellWidth: colStatus,      halign: "center" },
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