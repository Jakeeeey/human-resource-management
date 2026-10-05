import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { paintStroke, parseInk } from "./signingStrokes";

export interface ClearancePrintRow {
    category: string;
    signer: string;
    status: string;
    signedOn: string;
}

export interface ClearancePrintSignature {
    label: string;
    signerLine: string;
    signatureDataUrl: string | null;
}

export interface ClearancePrintInput {
    employeeName: string;
    templateTitle: string;
    statusLabel: string;
    progressLabel: string;
    assignedOn: string;
    confirmedOn: string;
    advisory: string;
    rows: ClearancePrintRow[];
    signatures: ClearancePrintSignature[];
}

const PAGE_MARGIN = 48;
const BODY_SIZE = 10;
const BODY_LINE = 15;
const TITLE_SIZE = 16;
const SECTION_SIZE = 12;
const FOOTER_SIZE = 8;
const GREY = 110;
const SIGNATURE_BOX_WIDTH = 220;
const SIGNATURE_BOX_HEIGHT = 66;

export function strokesToSignatureDataUrl(raw: string | null | undefined): string | null {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    let strokes: ReturnType<typeof parseInk>["pages"][number]["strokes"];
    try {
        const ink = parseInk(raw);
        strokes = ink.pages.flatMap((page) => page.strokes);
    } catch {
        return null;
    }
    if (strokes.length === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    for (const stroke of strokes) paintStroke(ctx, stroke);
    const url = canvas.toDataURL("image/png");
    return url === "data:," ? null : url;
}

function finalYOf(doc: jsPDF): number {
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function buildClearancePdf(input: ClearancePrintInput): Blob {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const bottomLimit = pageHeight - PAGE_MARGIN - 20;
    let y = PAGE_MARGIN;

    function ensureSpace(needed: number): void {
        if (y + needed > bottomLimit) {
            doc.addPage();
            y = PAGE_MARGIN;
        }
    }

    function wrapped(text: string, bold: boolean): void {
        const lines = doc.splitTextToSize(text, contentWidth) as string[];
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        for (const line of lines) {
            ensureSpace(BODY_LINE);
            doc.text(line, PAGE_MARGIN, y);
            y += BODY_LINE;
        }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(0);
    doc.text("Resignation Clearance", PAGE_MARGIN, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(0);
    wrapped(`Employee: ${input.employeeName}`, false);
    wrapped(`Clearance form: ${input.templateTitle}`, false);
    wrapped(`Status: ${input.statusLabel} (${input.progressLabel})`, false);
    wrapped(`Assigned: ${input.assignedOn}`, false);
    wrapped(`Confirmed: ${input.confirmedOn}`, false);
    y += 6;

    const advisoryLines = doc.splitTextToSize(`Note: ${input.advisory}`, contentWidth - 16) as string[];
    ensureSpace(advisoryLines.length * BODY_LINE + 20);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(180, 160, 120);
    doc.roundedRect(PAGE_MARGIN, y, contentWidth, advisoryLines.length * BODY_LINE + 14, 4, 4, "FD");
    y += BODY_LINE;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(90, 70, 20);
    for (const line of advisoryLines) {
        doc.text(line, PAGE_MARGIN + 8, y);
        y += BODY_LINE;
    }
    y += 10;
    doc.setTextColor(0);

    autoTable(doc, {
        startY: y,
        head: [["Category", "Signer", "Status", "Signed on"]],
        body: input.rows.map((row) => [row.category, row.signer, row.status, row.signedOn]),
        margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, valign: "middle" },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.4 },
            1: { cellWidth: contentWidth * 0.25 },
            2: { cellWidth: contentWidth * 0.12 },
            3: { cellWidth: contentWidth * 0.23 },
        },
    });
    y = finalYOf(doc) + 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(SECTION_SIZE);
    ensureSpace(30);
    doc.setTextColor(0);
    doc.text("Signatures", PAGE_MARGIN, y);
    y += BODY_LINE + 4;

    for (const entry of input.signatures) {
        ensureSpace(BODY_LINE * 2 + SIGNATURE_BOX_HEIGHT + 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        const labelLines = doc.splitTextToSize(entry.label, contentWidth) as string[];
        for (const line of labelLines) {
            ensureSpace(BODY_LINE);
            doc.text(line, PAGE_MARGIN, y);
            y += BODY_LINE;
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(GREY);
        const signerLines = doc.splitTextToSize(entry.signerLine, contentWidth) as string[];
        for (const line of signerLines) {
            ensureSpace(BODY_LINE);
            doc.text(line, PAGE_MARGIN, y);
            y += BODY_LINE;
        }
        doc.setTextColor(0);
        y += 4;
        ensureSpace(SIGNATURE_BOX_HEIGHT + 8);
        if (entry.signatureDataUrl) {
            try {
                const props = doc.getImageProperties(entry.signatureDataUrl);
                const imageWidth = SIGNATURE_BOX_HEIGHT * (props.width / props.height);
                const width = Math.min(imageWidth, SIGNATURE_BOX_WIDTH);
                doc.addImage(entry.signatureDataUrl, "PNG", PAGE_MARGIN, y, width, SIGNATURE_BOX_HEIGHT);
            } catch {
                doc.setDrawColor(0);
                doc.rect(PAGE_MARGIN, y, SIGNATURE_BOX_WIDTH, SIGNATURE_BOX_HEIGHT);
            }
        } else {
            doc.setDrawColor(0);
            doc.setLineWidth(0.75);
            doc.rect(PAGE_MARGIN, y, SIGNATURE_BOX_WIDTH, SIGNATURE_BOX_HEIGHT);
        }
        y += SIGNATURE_BOX_HEIGHT + 18;
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(FOOTER_SIZE);
        doc.setTextColor(GREY);
        doc.text(`Page ${page} of ${totalPages}`, pageWidth / 2, pageHeight - 22, { align: "center" });
    }
    doc.setTextColor(0);
    return doc.output("blob");
}

export function downloadClearancePdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
