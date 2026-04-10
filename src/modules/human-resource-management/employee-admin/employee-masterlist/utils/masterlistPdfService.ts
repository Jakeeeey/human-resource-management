/**
 * Masterlist PDF Service
 * Generates an Employee Masterlist Summary PDF
 * Format: Landscape, Legal (14" × 8.5")
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { User, Department } from "../types";

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = {
  primary:    [30,  64, 175]  as [number, number, number], // indigo-800
  secondary:  [99, 102, 241]  as [number, number, number], // indigo-500
  accent:     [16, 185, 129]  as [number, number, number], // emerald-500
  muted:      [148,163,184]   as [number, number, number], // slate-400
  surface:    [248,250,252]   as [number, number, number], // slate-50
  border:     [226,232,240]   as [number, number, number], // slate-200
  text:       [15,  23,  42]  as [number, number, number], // slate-900
  textLight:  [100,116,139]   as [number, number, number], // slate-500
  white:      [255,255,255]   as [number, number, number],
  chartColors: [
    [99,  102, 241] as [number, number, number],
    [16,  185, 129] as [number, number, number],
    [245, 158,  11] as [number, number, number],
    [239,  68,  68] as [number, number, number],
    [139,  92, 246] as [number, number, number],
    [20,  184, 166] as [number, number, number],
    [249, 115,  22] as [number, number, number],
    [236,  72, 153] as [number, number, number],
  ],
};

interface PdfData {
  employees: User[];
  departments: Department[];
  companyName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeptName(deptId: number | null | undefined, departments: Department[]): string {
  if (!deptId) return "Unassigned";
  return departments.find((d) => d.department_id === deptId)?.department_name ?? "Unassigned";
}

function fmt(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Draws a horizontal bar chart on a canvas and returns a PNG data URL */
function drawBarChart(
  labels: string[],
  values: number[],
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = width  * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  const pad   = { top: 18, right: 35, bottom: 8, left: 110 };
  const chartW = width  - pad.left - pad.right;
  const chartH = height - pad.top  - pad.bottom;
  const maxVal = Math.max(...values, 1);
  
  // Further spacing between departments
  const rowCount = Math.max(labels.length, 1);
  const rowH    = chartH / rowCount;
  // Increase gap: Make bar even thinner (45% of row height)
  const barH    = Math.min(12, rowH * 0.45);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  labels.forEach((label, i) => {
    const barW = (values[i] / maxVal) * chartW;
    const y    = pad.top + i * rowH + (rowH - barH) / 2;
    const color = COLORS.chartColors[i % COLORS.chartColors.length];

    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.roundRect(pad.left, y, chartW, barH, 4);
    ctx.fill();

    ctx.fillStyle = `rgb(${color.join(",")})`;
    ctx.beginPath();
    ctx.roundRect(pad.left, y, barW, barH, 4);
    ctx.fill();

    ctx.fillStyle = "#64748b";
    ctx.font = "600 8.5px Inter, Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const displayLabel = label.length > 20 ? label.slice(0, 19) + "…" : label;
    ctx.fillText(displayLabel, pad.left - 10, y + barH / 2);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 9px Inter, Arial";
    ctx.textAlign = "left";
    ctx.fillText(String(values[i]), pad.left + barW + 8, y + barH / 2);
  });

  return canvas.toDataURL("image/png");
}

/** Draws a pie/donut chart on a canvas and returns a PNG data URL */
function drawTotalCircle(
  total: number,
  width: number,
  height: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width  = width  * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  const cx    = width  / 2;
  const cy    = height / 2;
  const r     = Math.min(width, height) / 2 - 20;
  const inner = r * 0.8;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.fillStyle = "#6366f1"; // primary blue
  ctx.fill();

  // White center hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Highlight arc
  ctx.beginPath();
  ctx.arc(cx, cy, (r + inner) / 2, -Math.PI / 2, Math.PI / 4);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Centre text
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(total), cx, cy - 4);
  
  ctx.font = "bold 9px Inter, Arial";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("EMPLOYEES", cx, cy + 14);

  return canvas.toDataURL("image/png");
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateMasterlistPdf(data: PdfData): Promise<jsPDF> {
  const { employees, departments, companyName = "Human Resource Management" } = data;

  // ── Page: landscape legal (14 × 8.5 in = 1008 × 612 pt) ──────────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "legal" });
  const PW = doc.internal.pageSize.getWidth();   // 1008
  const PH = doc.internal.pageSize.getHeight();  // 612
  const margin = 28;

  // ── Build department stats ─────────────────────────────────────────────────
  const deptCount: Record<string, number> = {};
  employees.forEach((emp) => {
    const name = getDeptName(emp.department, departments);
    deptCount[name] = (deptCount[name] ?? 0) + 1;
  });
  const sortedDepts = Object.entries(deptCount).sort((a, b) => b[1] - a[1]);
  const deptLabels  = sortedDepts.map(([k]) => k);
  const deptValues  = sortedDepts.map(([, v]) => v);

  const activeCount = employees.filter((e) => {
    const val = e.isDeleted ?? (e as unknown as Record<string, unknown>).is_deleted ?? (e as unknown as Record<string, unknown>).deleted;
    if (val === undefined || val === null) return true; // Assume active if missing
    
    // 1. Handle standard Buffer/Object from DB: { type: "Buffer", data: [1] }
    if (typeof val === 'object' && 'data' in val && Array.isArray(val.data)) {
      return val.data[0] === 0;
    }
    
    // 2. Handle Strings: "1", "0", "true", "false"
    if (typeof val === 'string') {
      const s = val.toLowerCase();
      return s !== '1' && s !== 'true';
    }
    
    // 3. Handle Number/Boolean: 1/0, true/false
    return !val;
  }).length;

  // ─── Header banner ────────────────────────────────────────────────────────
  // Background gradient strip
  const gradH = 72;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, PW, gradH, "F");

  // Accent stripe
  doc.setFillColor(...COLORS.secondary);
  doc.rect(0, gradH - 4, PW, 4, "F");

  // Company / title text
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(companyName.toUpperCase(), margin, 26);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Employee Masterlist Summary Report", margin, 44);

  // Generated date (right-aligned)
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 240);
  doc.text(`Generated: ${dateStr} at ${timeStr}`, PW - margin, 30, { align: "right" });
  doc.text(`Total Records: ${employees.length}`, PW - margin, 44, { align: "right" });

  // ─── Summary cards row ────────────────────────────────────────────────────
  const cardY = gradH + 18;
  const cardH = 48;
  const cardGap = 12;
  const totalW = PW - margin * 2;
  
  // Weighted layout: Total card is prominent
  const cardWidths = [
    (totalW - cardGap * 2) * 0.58, // Total Employees
    (totalW - cardGap * 2) * 0.21, // Departments
    (totalW - cardGap * 2) * 0.21, // Active
  ];

  const cards = [
    { label: "Total Employees", value: employees.length, color: COLORS.primary   },
    { label: "Departments",     value: departments.length, color: COLORS.accent  },
    { label: "Active Records",  value: activeCount,        color: [30,130,102] as [number,number,number] },
  ];

  let currentX = margin;
  cards.forEach(({ label, value, color }, i) => {
    const w = cardWidths[i];
    // Card bg
    doc.setFillColor(...COLORS.surface);
    doc.roundedRect(currentX, cardY, w, cardH, 8, 8, "F");
    // Left accent bar
    doc.setFillColor(...color);
    doc.roundedRect(currentX, cardY, 6, cardH, 4, 4, "F");
    // Value
    doc.setTextColor(...color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(String(value), currentX + 16, cardY + 30);
    // Label
    doc.setTextColor(...COLORS.textLight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(label.toUpperCase(), currentX + 16, cardY + 41);
    
    currentX += w + cardGap;
  });

  // ─── Charts Section ──────────────────────────────────────────────────────
  const chartTop  = cardY + cardH + 20;
  const chartAreaW = PW - margin * 2;
  const chartH    = 220; // Increased from 175
  const gap       = 14;
  // Chart split: 80% for Department Bar Chart, 20% for Total Employees Circle
  const barW      = (chartAreaW - gap) * 0.79;
  const pieW      = (chartAreaW - gap) * 0.21;

  // Chart Containers
  doc.setDrawColor(220, 230, 245);
  doc.setLineWidth(0.8);
  doc.setFillColor(255, 255, 255);
  
  doc.roundedRect(margin, chartTop, barW, chartH, 6, 6, "FD");
  doc.roundedRect(margin + barW + gap, chartTop, pieW, chartH, 6, 6, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.text("DEPARTMENT DISTRIBUTION", margin + 14, chartTop + 18);
  doc.text("TOTAL EMPLOYEES", margin + barW + gap + 14, chartTop + 18);

  const barImgData = drawBarChart(deptLabels, deptValues, Math.round(barW - 28), Math.round(chartH - 40));
  doc.addImage(barImgData, "PNG", margin + 14, chartTop + 30, barW - 28, chartH - 40);

  const circleImgData = drawTotalCircle(employees.length, Math.round(pieW - 28), Math.round(chartH - 40));
  doc.addImage(circleImgData, "PNG", margin + barW + gap + 14, chartTop + 30, pieW - 28, chartH - 40);

  // Combined spacing on top cards (80% / 20% or similar re-alignment)
  // Actually the user said "spacing on the to cards like 80 20 percent" 
  // which might mean making the first card larger if that's what they intended.
  // But our charts now have that split. Let's do the same for the top cards area distribution.

  // Divider
  const tableTop = chartTop + chartH + 16;
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, tableTop - 4, PW - margin, tableTop - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);
  doc.text("FULL EMPLOYEE DIRECTORY", margin, tableTop + 10);

  // ─── Employee table ───────────────────────────────────────────────────────
  const rows = employees.map((emp, idx) => [
    String(idx + 1),
    `${emp.firstName} ${emp.lastName}`,
    emp.position || "—",
    getDeptName(emp.department, departments),
    [emp.brgy, emp.city, emp.province].filter(Boolean).join(", ") || "—",
    emp.email,
    emp.contact || "—",
    fmt(emp.dateOfHire),
  ]);

  autoTable(doc, {
    startY: tableTop + 20,
    margin: { left: margin, right: margin },
    head: [["#", "Employee Name", "Position", "Department", "Home Address", "Email", "Phone No.", "Date Hired"]],
    body: rows,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
      textColor: COLORS.text,
      lineColor: COLORS.border,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
    },
    alternateRowStyles: {
      fillColor: COLORS.surface,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 120 },
      2: { cellWidth: 100 },
      3: { cellWidth: 100 },
      4: { cellWidth: 220 },
      5: { cellWidth: "auto" },
      6: { cellWidth: 80 },
      7: { cellWidth: 70 },
    },
    didDrawPage: (hookData) => {
      // Footer on each page
      const pageNum = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.textLight);
      doc.text(
        `Page ${hookData.pageNumber} of ${pageNum}  •  Employee Masterlist Summary  •  ${companyName}`,
        PW / 2,
        PH - 12,
        { align: "center" }
      );
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.3);
      doc.line(margin, PH - 18, PW - margin, PH - 18);
    },
  });

  return doc;
}
