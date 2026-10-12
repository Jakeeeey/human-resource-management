import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { ServiceRecordDataResponse, ServiceRecordEntry } from "../type";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";

export interface GeneratePdfOptions {
  preparedByName?: string;
  preparedByTitle?: string;
  certifiedByName?: string;
  certifiedByTitle?: string;
  certificationDate?: Date;
  useDittoMarks?: boolean;
  headerStyle?: "template" | "official";
  templateName?: string;
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

export async function generateServiceRecordPdf(
  data: ServiceRecordDataResponse,
  options: GeneratePdfOptions = {}
): Promise<jsPDF> {
  const { employee, records, setting, is_still_in_service } = data;
  const headerStyle = options.headerStyle ?? "template";

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const formatDateString = (dateStr?: string | null, formatPattern: string = "MM/dd/yy") => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, formatPattern);
    } catch {
      return dateStr;
    }
  };

  const formatBirthDate = (dateStr?: string | null) => {
    if (!dateStr) return "--";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, "MMMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  // ==========================================================================
  // 1. TOP HEADER & LETTERHEAD
  // ==========================================================================
  let currentY = 18;
  let templateApplied = false;
  let companyData: Record<string, unknown> | null = null;

  if (headerStyle === "template") {
    try {
      const [fetchedCompany, templates] = await Promise.all([
        fetchCompanyData(),
        pdfTemplateService.fetchTemplates().catch(() => []),
      ]);

      companyData = fetchedCompany;

      const chosenTemplate =
        (options.templateName && templates.find((t) => t.name === options.templateName)?.name) ||
        templates.find((t) => t.name.toLowerCase() === "header" || t.name.toLowerCase() === "official header")?.name ||
        templates[0]?.name;

      if (chosenTemplate) {
        const templateData = {
          ...companyData,
          employee_name: `${employee.user_lname}, ${employee.user_fname} ${employee.user_mname || ""}`.trim(),
          employee_id: employee.user_id,
          department: employee.department_name || "",
        };

        const safeY = await PdfEngine.applyTemplate(doc, chosenTemplate, templateData);
        if (safeY > 15) {
          currentY = safeY + 4;
          templateApplied = true;
        }
      }
    } catch (err) {
      console.warn("Failed to apply PDF template header, using fallback:", err);
    }
  }

  // Header Rendering based on selected headerStyle
  if (!templateApplied) {
    if (headerStyle === "template" && companyData?.company_name) {
      // Use Company Information
      currentY = 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(String(companyData.company_name), pageWidth / 2, currentY, { align: "center" });
      currentY += 5;

      const addressParts = [
        companyData.company_address,
        companyData.company_city,
        companyData.company_province,
      ].filter(Boolean);

      if (addressParts.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(addressParts.join(", "), pageWidth / 2, currentY, { align: "center" });
        currentY += 4.5;
      }

      if (companyData.company_contact || companyData.company_email) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const contactLine = [companyData.company_contact, companyData.company_email].filter(Boolean).join(" | ");
        doc.text(contactLine, pageWidth / 2, currentY, { align: "center" });
        currentY += 4.5;
      }

      currentY += 4;
    } else {
      // Official Government Letterhead
      currentY = 18;
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(
        setting?.agency_name || "Republic of the Philippines",
        pageWidth / 2,
        currentY,
        { align: "center" }
      );
      currentY += 5;

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.text(
        setting?.sub_header || "Civil Service Commission",
        pageWidth / 2,
        currentY,
        { align: "center" }
      );
      currentY += 10;
    }
  }

  // Title: S E R V I C E   R E C O R D
  doc.setFont("times", "bold");
  doc.setFontSize(12.5);
  doc.text("S E R V I C E   R E C O R D", pageWidth / 2, currentY, { align: "center" });
  currentY += 9;

  // ==========================================================================
  // 2. EMPLOYEE INFORMATION HEADER BLOCK
  // ==========================================================================
  doc.setFontSize(9);
  doc.setFont("times", "normal");

  // Row 1: Name line
  const nameLabelX = margin;
  doc.setFont("times", "bold");
  doc.text("Name:", nameLabelX, currentY);

  // Surname
  const surnameX = nameLabelX + 16;
  doc.setFont("times", "bold");
  doc.text((employee.user_lname || "").toUpperCase(), surnameX, currentY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("(Surname)", surnameX, currentY + 3.5);

  // Given Name
  const givenX = surnameX + 38;
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.text((employee.user_fname || "").toUpperCase(), givenX, currentY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("(Given)", givenX, currentY + 3.5);

  // Middle Name
  const middleX = givenX + 32;
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.text((employee.user_mname || "").toUpperCase(), middleX, currentY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("(Middle)", middleX, currentY + 3.5);

  // Maiden Name (at right)
  const maidenX = pageWidth - margin;
  doc.setFontSize(8.5);
  doc.setFont("times", "bolditalic");
  const maidenNameText = (employee.user_maiden_name || "").toUpperCase();
  doc.text(maidenNameText, maidenX, currentY, { align: "right" });
  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.text("(If married, give also full maiden name)", maidenX, currentY + 3.5, { align: "right" });

  currentY += 8.5;

  // Row 2: Birth line
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.text("Birth:", margin, currentY);

  const bdayX = margin + 16;
  doc.text(formatBirthDate(employee.user_bday), bdayX, currentY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("Date", bdayX + 10, currentY + 3.5);

  const pobX = bdayX + 54;
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.text(employee.user_birth_place || "--", pobX, currentY);
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.text("Place", pobX + 8, currentY + 3.5);

  // Note at right
  doc.setFontSize(7);
  doc.setFont("times", "normal");
  doc.text("(Date herein should be checked from", maidenX, currentY - 1, { align: "right" });
  doc.text("baptismal certificate or some other", maidenX, currentY + 2, { align: "right" });
  doc.text("reliable documents.)", maidenX, currentY + 5, { align: "right" });

  currentY += 8.5;

  // Row 3: BP Number line
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.text("BP Number:", margin, currentY);
  doc.text(employee.user_bp_number || "--", margin + 24, currentY);

  currentY += 7;

  // Certification Statement
  doc.setFontSize(8);
  doc.setFont("times", "normal");
  const certParagraph =
    setting?.certification_text ||
    "This is to certify that the employee named herein above actually rendered service in this Office as shown by the service record below. Each line of which is supported by appointment and other papers actually issued by this office and approved by the authorities concerned.";

  const certLines = doc.splitTextToSize(certParagraph, pageWidth - margin * 2);
  doc.text(certLines, margin, currentY);
  currentY += certLines.length * 3.8 + 2;

  // ==========================================================================
  // 3. TABLE GENERATION
  // ==========================================================================
  const sortedRecords = [...records].sort((a, b) => {
    const dateComp = new Date(a.service_from).getTime() - new Date(b.service_from).getTime();
    if (dateComp !== 0) return dateComp;
    return (a.sequence_order || 0) - (b.sequence_order || 0);
  });

  const tableRows = sortedRecords.map((row: ServiceRecordEntry, index: number) => {
    const isLastRow = index === sortedRecords.length - 1;
    let toDisplay = formatDateString(row.service_to);
    if (isLastRow && is_still_in_service && (!row.service_to || row.service_to.trim() === "")) {
      toDisplay = "Present";
    }

    const prev = index > 0 && options.useDittoMarks ? sortedRecords[index - 1] : null;

    const designation = prev && prev.designation === row.designation ? "do" : row.designation;
    const status = prev && prev.appointment_status === row.appointment_status ? "do" : row.appointment_status;
    const station = prev && prev.station_assignment === row.station_assignment ? "do" : row.station_assignment;
    const branch = prev && prev.branch === row.branch ? "do" : row.branch;
    const leave = prev && prev.leave_wo_pay === row.leave_wo_pay ? "do" : row.leave_wo_pay || "None";

    return [
      formatDateString(row.service_from),
      toDisplay || "Present",
      designation,
      status,
      formatCurrency(row.salary),
      station,
      branch,
      leave,
      row.cause || "Orig. Appt.",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 42 },
    head: [
      [
        { content: "Services", colSpan: 2, styles: { halign: "center" } },
        { content: "RECORD OF APPOINTMENT", colSpan: 3, styles: { halign: "center" } },
        { content: "Station/Place of\nAssignment", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Branch", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "L/Abs.\nw/o pay", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        { content: "Cause", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      ],
      [
        { content: "From", styles: { halign: "center" } },
        { content: "To", styles: { halign: "center" } },
        { content: "Designation", styles: { halign: "center" } },
        { content: "Status", styles: { halign: "center" } },
        { content: "Salary", styles: { halign: "center" } },
      ],
    ],
    body:
      tableRows.length > 0
        ? tableRows
        : [["--", "--", "No service records recorded", "--", "--", "--", "--", "--", "--"]],
    theme: "plain",
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.25,
    styles: {
      font: "times",
      fontSize: 7.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.6,
      overflow: "linebreak",
    },
    headStyles: {
      font: "times",
      fontStyle: "bold",
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.25,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" }, // From
      1: { cellWidth: 16, halign: "center" }, // To
      2: { cellWidth: 26, halign: "center" }, // Designation
      3: { cellWidth: 18, halign: "center" }, // Status
      4: { cellWidth: 21, halign: "right" },  // Salary
      5: { cellWidth: 32, halign: "center" }, // Station
      6: { cellWidth: 16, halign: "center" }, // Branch
      7: { cellWidth: 16, halign: "center" }, // L/Abs
      8: { cellWidth: 21, halign: "center" }, // Cause
    },
  });

  // Get position where autoTable finished
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastAutoTable = (doc as any).lastAutoTable;
  let finalY = lastAutoTable ? lastAutoTable.finalY + 5 : currentY + 30;

  // Check room on the current page for the footer (need approx. 40mm)
  if (finalY > pageHeight - 48) {
    doc.addPage();
    finalY = 20;
  }

  // ==========================================================================
  // 4. (STILL IN THE SERVICE) INDICATOR
  // ==========================================================================
  if (is_still_in_service) {
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.text("(STILL IN THE SERVICE)", pageWidth / 2, finalY, { align: "center" });
    finalY += 6;
  } else {
    finalY += 3;
  }

  // ==========================================================================
  // 5. COMPLIANCE FOOTNOTE
  // ==========================================================================
  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  const complianceText =
    setting?.legal_basis_text ||
    "Issued in compliance with Executive Order No. 54, dated August 10, 1954 in accordance with Circular No. 54, dated August 10, 1954 of the System.";
  const compLines = doc.splitTextToSize(complianceText, pageWidth - margin * 2);
  doc.text(compLines, margin, finalY);
  finalY += compLines.length * 3.5 + 10;

  // ==========================================================================
  // 6. DUAL SIGNATORIES
  // ==========================================================================
  const preparedName = options.preparedByName || setting?.default_prepared_by_name || "MELISSA O. SESIO";
  const preparedTitle = options.preparedByTitle || setting?.default_prepared_by_title || "Admin. Officer II";

  const certifiedName = options.certifiedByName || setting?.default_certified_by_name || "JOHN D. ALIDON";
  const certifiedTitle = options.certifiedByTitle || setting?.default_certified_by_title || "Admin. Officer IV/HRMO II";
  const certDateText = format(options.certificationDate || new Date(), "MMMM dd, yyyy");

  // Left Signatory (Prepared by)
  const leftX = margin + 12;
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("Prepared by:", leftX, finalY);

  const leftSignY = finalY + 12;
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text(preparedName.toUpperCase(), leftX + 18, leftSignY, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(preparedTitle, leftX + 18, leftSignY + 4, { align: "center" });

  // Right Signatory (Certified correct)
  const rightX = pageWidth - margin - 50;
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text("Certified correct:", rightX - 25, finalY + 8);

  const rightSignY = finalY + 18;
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text(certifiedName.toUpperCase(), rightX, rightSignY, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.text(certifiedTitle, rightX, rightSignY + 4, { align: "center" });

  // Date below Certified correct
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.text(certDateText, rightX, rightSignY + 13, { align: "center" });

  // ==========================================================================
  // 7. PAGE NUMBERS ON ALL PAGES
  // ==========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.text(`${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  return doc;
}
