import { jsPDF } from "jspdf";
import { __createTable, __drawTable } from "jspdf-autotable";
import type { CellDef, RowInput } from "jspdf-autotable";

import type { SoaSignatory } from "../types";

export interface SoaPrintLine {
    department: string;
    description: string;
    amount: number | null;
    remarks: string;
}

export interface SoaPrintInput {
    refNo: string;
    clearanceNo: string;
    employeeName: string;
    position: string;
    dateOfSeparation: string;
    companyName: string;
    companyAddress: string;
    logoDataUrl: string | null;
    signatories: SoaSignatory[];
    lines: SoaPrintLine[];
}

const MARGIN = 48;
const RED_R = 204;
const RED_G = 0;
const RED_B = 0;
const GREY = 110;
const HEADER_FILL: [number, number, number] = [51, 51, 51];
const MIN_ROWS_PER_DEPARTMENT = 3;
const LOGO_HEIGHT = 40;
const LOGO_MAX_WIDTH = 160;

function formatAmount(value: number): string {
    return "Php. " + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sniffImageFormat(dataUrl: string): string | null {
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
        return "JPEG";
    }
    if (dataUrl.startsWith("data:image/png")) {
        return "PNG";
    }
    return null;
}

export function buildSoaPdf(input: SoaPrintInput): Uint8Array {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const rightEdge = pageWidth - MARGIN;
    const contentWidth = pageWidth - MARGIN * 2;
    let y = MARGIN;

    let textX = MARGIN;
    let logoHeight = 0;
    const logoFormat = input.logoDataUrl === null ? null : sniffImageFormat(input.logoDataUrl);
    if (input.logoDataUrl !== null && logoFormat !== null) {
        try {
            const props = doc.getImageProperties(input.logoDataUrl);
            const ratio = props.width / props.height;
            let logoWidth = LOGO_HEIGHT * ratio;
            let scaledHeight = LOGO_HEIGHT;
            if (logoWidth > LOGO_MAX_WIDTH) {
                logoWidth = LOGO_MAX_WIDTH;
                scaledHeight = logoWidth / ratio;
            }
            doc.addImage(input.logoDataUrl, logoFormat, MARGIN, y, logoWidth, scaledHeight);
            textX = MARGIN + logoWidth + 12;
            logoHeight = scaledHeight;
        } catch {
            textX = MARGIN;
            logoHeight = 0;
        }
    }

    let headerTextHeight = 0;
    if (input.companyName !== "") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0);
        const nameLines = doc.splitTextToSize(input.companyName, rightEdge - textX);
        doc.text(nameLines, textX, y + 14);
        headerTextHeight += nameLines.length * 16;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    const addressLines = doc.splitTextToSize("ADDRESS: " + input.companyAddress, rightEdge - textX);
    doc.text(addressLines, textX, y + 14 + headerTextHeight);
    headerTextHeight += addressLines.length * 12 + 4;
    y += Math.max(logoHeight, headerTextHeight) + 12;

    const refRows: Array<[string, string]> = [
        ["REF No.:", input.refNo],
        ["Clearance No:", input.clearanceNo],
    ];
    for (const [label, value] of refRows) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const valueWidth = Math.max(150, value === "" ? 0 : doc.getTextWidth(value));
        const valueX = rightEdge - valueWidth;
        doc.setTextColor(0);
        if (value !== "") {
            doc.text(value, valueX, y);
        }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(RED_R, RED_G, RED_B);
        doc.text(label, valueX - 6, y, { align: "right" });
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(valueX, y + 4, rightEdge, y + 4);
        y += 18;
    }
    doc.setTextColor(0);
    y += 6;

    const fields: Array<[string, string]> = [
        ["Employee Name:", input.employeeName],
        ["Position:", input.position],
        ["Date of Separation:", input.dateOfSeparation],
    ];
    for (const [label, value] of fields) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(label, MARGIN, y);
        const valueX = MARGIN + doc.getTextWidth(label) + 6;
        if (value !== "") {
            doc.text(value, valueX, y);
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, y + 4, rightEdge, y + 4);
        y += 22;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("STATEMENT OF ACCOUNT", pageWidth / 2, y + 6, { align: "center" });
    y += 26;

    const groups: Array<{ department: string; rows: SoaPrintLine[] }> = [];
    for (const line of input.lines) {
        const current = groups[groups.length - 1];
        if (current !== undefined && current.department === line.department) {
            current.rows.push(line);
        } else {
            groups.push({ department: line.department, rows: [line] });
        }
    }
    const counts = groups.map((group) => Math.max(MIN_ROWS_PER_DEPARTMENT, group.rows.length));
    const totalRows = counts.reduce((sum, count) => sum + count, 0);

    const body: RowInput[] = [];
    groups.forEach((group, groupIndex) => {
        const count = counts[groupIndex];
        for (let row = 0; row < count; row += 1) {
            const line = group.rows[row];
            const description = line === undefined ? "" : line.description;
            const amount = line === undefined || line.amount === null ? "" : formatAmount(line.amount);
            const remarks = line === undefined ? "" : line.remarks;
            if (row === 0) {
                const departmentCell: CellDef = { content: group.department, rowSpan: count };
                if (groupIndex === 0) {
                    const verifyCell: CellDef = { content: "", rowSpan: totalRows };
                    body.push([departmentCell, description, amount, remarks, verifyCell]);
                } else {
                    body.push([departmentCell, description, amount, remarks]);
                }
            } else {
                body.push([description, amount, remarks]);
            }
        }
    });

    const table = __createTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["DEPARTMENT", "DESCRIPTION", "AMOUNT", "REMARKS", ["DATE & VERIFIED BY:", "NAME OVER SIGNATURE"]]],
        body,
        theme: "grid",
        styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 5,
            textColor: 0,
            lineColor: 0,
            lineWidth: 0.5,
            valign: "middle",
        },
        headStyles: {
            fillColor: HEADER_FILL,
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        columnStyles: {
            0: { cellWidth: 96, halign: "center" },
            2: { cellWidth: 84, halign: "right" },
            3: { cellWidth: 108 },
            4: { cellWidth: 96, halign: "center" },
        },
    });
    __drawTable(doc, table);

    let footerY = (table.finalY ?? y) + 30;
    const signerCount = input.signatories.length;
    if (signerCount > 0) {
        if (footerY + 110 > pageHeight - MARGIN) {
            doc.addPage();
            footerY = MARGIN;
        }
        const columnWidth = contentWidth / signerCount;
        input.signatories.forEach((signatory, index) => {
            const x = MARGIN + index * columnWidth + 8;
            const width = columnWidth - 16;
            const centerX = x + width / 2;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0);
            if (signatory.label !== "") {
                doc.text(signatory.label, x, footerY);
            }
            doc.setDrawColor(0);
            doc.setLineWidth(0.75);
            doc.line(x, footerY + 44, x + width, footerY + 44);
            if (signatory.name !== "") {
                doc.text(signatory.name, centerX, footerY + 58, { align: "center" });
            }
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(GREY);
            if (signatory.title !== "") {
                doc.text(signatory.title, centerX, footerY + 71, { align: "center" });
            }
            doc.setTextColor(0);
        });
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(GREY);
        doc.text("Page " + page + " of " + totalPages, pageWidth / 2, pageHeight - 22, { align: "center" });
    }
    doc.setTextColor(0);
    return new Uint8Array(doc.output("arraybuffer"));
}
