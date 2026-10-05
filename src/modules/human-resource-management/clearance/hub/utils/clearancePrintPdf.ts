import { jsPDF } from "jspdf";

import { paintStroke, parseInk } from "./signingStrokes";

export interface ClearancePrintEntry {
    category: string;
    signeeName: string;
    signatureDataUrl: string | null;
}

export interface ClearancePrintInput {
    employeeName: string;
    entries: ClearancePrintEntry[];
}

const PAGE_MARGIN = 48;
const COLUMN_GAP = 36;
const BODY_SIZE = 10;
const BODY_LINE = 15;
const TITLE_SIZE = 16;
const FOOTER_SIZE = 8;
const GREY = 110;
const SLOT_HEIGHT = 52;
const IMAGE_HEIGHT = 42;
const ROW_GAP = 18;
const NAME_GAP = 16;
const CATEGORY_SIZE = 8;
const CATEGORY_LINE = 12;
const CATEGORY_GAP = 4;

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

function tryPlaceSignature(
    doc: jsPDF,
    dataUrl: string,
    x: number,
    baseline: number,
    maxWidth: number
): void {
    try {
        const props = doc.getImageProperties(dataUrl);
        const ratio = props.width / props.height;
        const height = Math.min(IMAGE_HEIGHT, maxWidth / ratio);
        const width = height * ratio;
        doc.addImage(dataUrl, "PNG", x, baseline - height, width, height);
    } catch {
        return;
    }
}

export function buildClearancePdf(input: ClearancePrintInput): Blob {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const columnWidth = (contentWidth - COLUMN_GAP) / 2;
    const bottomLimit = pageHeight - PAGE_MARGIN - 20;
    let y = PAGE_MARGIN;

    function ensureSpace(needed: number): void {
        if (y + needed > bottomLimit) {
            doc.addPage();
            y = PAGE_MARGIN;
        }
    }

    function entryHeight(entry: ClearancePrintEntry): number {
        const nameCount =
            entry.signeeName === ""
                ? 1
                : (doc.splitTextToSize(entry.signeeName, columnWidth) as string[]).length;
        const categoryCount = Math.max(
            1,
            (doc.splitTextToSize(entry.category, columnWidth) as string[]).length
        );
        return SLOT_HEIGHT + NAME_GAP + nameCount * BODY_LINE + CATEGORY_GAP + categoryCount * CATEGORY_LINE;
    }

    function renderEntry(entry: ClearancePrintEntry, x: number, top: number): void {
        const lineY = top + SLOT_HEIGHT;
        if (entry.signatureDataUrl) {
            tryPlaceSignature(doc, entry.signatureDataUrl, x, lineY, columnWidth);
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.75);
        doc.line(x, lineY, x + columnWidth, lineY);
        let cursor = lineY + NAME_GAP;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        if (entry.signeeName === "") {
            cursor += BODY_LINE;
        } else {
            const nameLines = doc.splitTextToSize(entry.signeeName, columnWidth) as string[];
            for (const line of nameLines) {
                doc.text(line, x, cursor);
                cursor += BODY_LINE;
            }
        }
        cursor += CATEGORY_GAP;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(CATEGORY_SIZE);
        doc.setTextColor(GREY);
        const categoryLines = doc.splitTextToSize(entry.category, columnWidth) as string[];
        for (const line of categoryLines) {
            doc.text(line, x, cursor);
            cursor += CATEGORY_LINE;
        }
        doc.setTextColor(0);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(0);
    doc.text("Resignation Clearance", PAGE_MARGIN, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(0);
    const employeeLines = doc.splitTextToSize(`Employee: ${input.employeeName}`, contentWidth) as string[];
    for (const line of employeeLines) {
        ensureSpace(BODY_LINE);
        doc.text(line, PAGE_MARGIN, y);
        y += BODY_LINE;
    }
    y += 4;
    ensureSpace(20);
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(PAGE_MARGIN, y, PAGE_MARGIN + contentWidth, y);
    y += 18;

    if (input.entries.length === 0) {
        ensureSpace(BODY_LINE);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        doc.text("No categories on this clearance.", PAGE_MARGIN, y);
        y += BODY_LINE;
    }

    for (let index = 0; index < input.entries.length; index += 2) {
        const left = input.entries[index];
        if (left === undefined) continue;
        const right = input.entries[index + 1] ?? null;
        const rowHeight = Math.max(entryHeight(left), right ? entryHeight(right) : 0) + ROW_GAP;
        ensureSpace(rowHeight);
        renderEntry(left, PAGE_MARGIN, y);
        if (right) renderEntry(right, PAGE_MARGIN + columnWidth + COLUMN_GAP, y);
        y += rowHeight;
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
