import { GState, jsPDF } from "jspdf";
import { __createTable, __drawTable } from "jspdf-autotable";
import type { RowInput } from "jspdf-autotable";

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
    companyContact?: string | null;
    companyEmail?: string | null;
    logoDataUrl: string | null;
    signatories: SoaSignatory[];
    lines: SoaPrintLine[];
}

interface SoaLetterhead {
    company_name: string;
    company_address?: string | null;
    company_contact?: string | null;
    company_email?: string | null;
    logo_data_url?: string | null;
}

const MARGIN = 48;
const RED_R = 204;
const RED_G = 0;
const RED_B = 0;
const GREY = 110;
const HEADER_FILL: [number, number, number] = [0, 0, 0];
const MIN_ROWS_PER_DEPARTMENT = 3;
const LETTERHEAD_NAME_SIZE = 15;
const LETTERHEAD_META_SIZE = 9;
const WATERMARK_MAX_WIDTH = 460;
const WATERMARK_MAX_HEIGHT = 330;
const WATERMARK_OPACITY = 0.14;
const LETTERHEAD_LOGO_MAX_WIDTH = 150;
const LETTERHEAD_LOGO_MAX_HEIGHT = 58;

function formatAmount(value: number): string {
    return "Php. " + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tryPlaceLogo(doc: jsPDF, dataUrl: string, x: number, y: number): void {
    try {
        const props = doc.getImageProperties(dataUrl);
        if (props.width <= 0 || props.height <= 0) return;
        const scale = Math.min(LETTERHEAD_LOGO_MAX_WIDTH / props.width, LETTERHEAD_LOGO_MAX_HEIGHT / props.height);
        const width = props.width * scale;
        const height = props.height * scale;
        const offsetX = x + (LETTERHEAD_LOGO_MAX_WIDTH - width) / 2;
        const offsetY = y + (LETTERHEAD_LOGO_MAX_HEIGHT - height) / 2;
        const format = dataUrl.indexOf("data:image/jpeg") === 0 ? "JPEG" : "PNG";
        doc.addImage(dataUrl, format, offsetX, offsetY, width, height);
    } catch {
        return;
    }
}

function drawLetterhead(doc: jsPDF, company: SoaLetterhead, y: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const logo = company.logo_data_url ?? "";
    if (logo !== "") {
        tryPlaceLogo(doc, logo, MARGIN, y);
    }
    const rightEdge = pageWidth - MARGIN;
    const textCenterX =
        logo !== "" ? (MARGIN + LETTERHEAD_LOGO_MAX_WIDTH + 12 + rightEdge) / 2 : pageWidth / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(LETTERHEAD_NAME_SIZE);
    doc.setTextColor(0);
    doc.text(company.company_name, textCenterX, y + 14, { align: "center" });
    let cursor = y + 32;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(LETTERHEAD_META_SIZE);
    const address = company.company_address ?? "";
    if (address !== "") {
        doc.text(address, textCenterX, cursor, { align: "center" });
        cursor += 13;
    }
    const contactParts: string[] = [];
    const contact = company.company_contact ?? "";
    const email = company.company_email ?? "";
    if (contact !== "") {
        contactParts.push(contact);
    }
    if (email !== "") {
        contactParts.push(email);
    }
    if (contactParts.length > 0) {
        doc.text(contactParts.join(" | "), textCenterX, cursor, { align: "center" });
        cursor += 13;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    const ruleY = Math.max(cursor + 4, y + LETTERHEAD_LOGO_MAX_HEIGHT + 6);
    doc.line(MARGIN, ruleY, pageWidth - MARGIN, ruleY);
    return ruleY + 18;
}

function drawWatermark(doc: jsPDF, logoDataUrl: string | null): void {
    if (!logoDataUrl) return;
    const format = logoDataUrl.indexOf("data:image/jpeg") === 0 ? "JPEG" : "PNG";
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
        doc.setPage(page);
        try {
            const props = doc.getImageProperties(logoDataUrl);
            if (props.width <= 0 || props.height <= 0) continue;
            const scale = Math.min(WATERMARK_MAX_WIDTH / props.width, WATERMARK_MAX_HEIGHT / props.height);
            const width = props.width * scale;
            const height = props.height * scale;
            doc.setGState(new GState({ opacity: WATERMARK_OPACITY }));
            doc.addImage(logoDataUrl, format, (doc.internal.pageSize.getWidth() - width) / 2, (doc.internal.pageSize.getHeight() - height) / 2, width, height);
            doc.setGState(new GState({ opacity: 1 }));
        } catch {
            doc.setGState(new GState({ opacity: 1 }));
        }
    }
}

export function buildSoaPdf(input: SoaPrintInput): Uint8Array {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const rightEdge = pageWidth - MARGIN;
    const contentWidth = pageWidth - MARGIN * 2;
    let y = MARGIN;

    if (input.companyName !== "") {
        y = drawLetterhead(
            doc,
            {
                company_name: input.companyName,
                company_address: input.companyAddress,
                company_contact: input.companyContact,
                company_email: input.companyEmail,
                logo_data_url: input.logoDataUrl,
            },
            y
        );
    }

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
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
    const fieldLabelWidth = Math.max(...fields.map(([label]) => doc.getTextWidth(label)));
    const fieldX = MARGIN + fieldLabelWidth + 6;
    for (const [label, value] of fields) {
        doc.text(label, MARGIN, y);
        if (value !== "") {
            doc.text(value, fieldX, y);
        }
        const valueWidth = value === "" ? 0 : doc.getTextWidth(value);
        const fieldEndX = Math.min(rightEdge, fieldX + Math.max(115, valueWidth + 12));
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(fieldX, y + 4, fieldEndX, y + 4);
        y += 22;
    }

    doc.setFont("times", "bold");
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

    const body: RowInput[] = [];
    const groupFirst: boolean[] = [];
    const groupLast: boolean[] = [];
    const groupStart: number[] = [];
    groups.forEach((group, groupIndex) => {
        const count = counts[groupIndex] ?? 0;
        groupStart.push(body.length);
        for (let row = 0; row < count; row += 1) {
            const line = group.rows[row];
            const description = line === undefined ? "" : line.description;
            const amount = line === undefined || line.amount === null ? "" : formatAmount(line.amount);
            const remarks = line === undefined ? "" : line.remarks;
            const department = row === 0 ? group.department : "";
            body.push([department, description, amount, remarks, ""]);
            groupFirst.push(row === 0);
            groupLast.push(row === count - 1);
        }
    });

    const rowPage: number[] = [];
    const rowGeom: Array<{ x: number; y: number; width: number; height: number }> = [];

    const table = __createTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [["DEPARTMENT", "DESCRIPTION", "AMOUNT", "REMARKS", "DATE & VERIFIED BY:\nNAME OVER SIGNATURE"]],
        body,
        theme: "grid",
        styles: {
            font: "times",
            fontSize: 9,
            cellPadding: 5,
            textColor: 0,
            lineColor: 0,
            lineWidth: 0.5,
            valign: "middle",
        },
        headStyles: {
            font: "helvetica",
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
            4: { cellWidth: 124, halign: "center" },
        },
        rowPageBreak: "avoid",
        willDrawCell: (data) => {
            if (data.section !== "body") {
                return;
            }
            if (data.column.index === 0) {
                rowPage[data.row.index] = data.pageNumber;
                rowGeom[data.row.index] = {
                    x: data.cell.x,
                    y: data.cell.y,
                    width: data.cell.width,
                    height: data.cell.height,
                };
            }
            if (data.column.index !== 0 && data.column.index !== 4) {
                return;
            }
            const first = groupFirst[data.row.index];
            const last = groupLast[data.row.index];
            if (first === undefined || last === undefined) {
                return;
            }
            data.cell.styles.lineWidth = {
                top: first ? 0.5 : 0,
                left: 0.5,
                right: 0.5,
                bottom: last ? 0.5 : 0,
            };
        },
    });
    __drawTable(doc, table);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);
    groups.forEach((group, groupIndex) => {
        const count = counts[groupIndex] ?? 0;
        const start = groupStart[groupIndex] ?? 0;
        const seen = new Set<number>();
        for (let row = 0; row < count; row += 1) {
            const page = rowPage[start + row];
            if (page === undefined || seen.has(page)) continue;
            seen.add(page);
            if (row === 0) continue;
            const geom = rowGeom[start + row];
            if (!geom) continue;
            doc.setPage(page);
            const wrapped = doc.splitTextToSize(group.department + " (continued)", geom.width - 10);
            const lineHeight = 11;
            const centerY = geom.y + geom.height / 2;
            const firstBaseline = centerY - ((wrapped.length - 1) * lineHeight) / 2 + 3;
            doc.text(wrapped, geom.x + geom.width / 2, firstBaseline, { align: "center" });
        }
    });
    doc.setTextColor(0);

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
            doc.setFont("times", "bold");
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
            doc.setFont("times", "normal");
            doc.setFontSize(9);
            doc.setTextColor(GREY);
            if (signatory.title !== "") {
                doc.text(signatory.title, centerX, footerY + 71, { align: "center" });
            }
            doc.setTextColor(0);
        });
    }

    drawWatermark(doc, input.logoDataUrl ?? null);

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
