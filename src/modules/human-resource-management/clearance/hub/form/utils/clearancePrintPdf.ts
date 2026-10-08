import { jsPDF } from "jspdf";

export interface ClearancePrintEntry {
    category: string;
    signeeName: string;
    signatureDataUrl: string | null;
    remarks: string;
}

export interface ClearancePrintInput {
    employeeName: string;
    entries: ClearancePrintEntry[];
    refNo?: string;
    date?: string;
    position?: string;
    company_name?: string;
    company_address?: string | null;
    logo_data_url?: string | null;
    gmName?: string;
    gmTitle?: string;
}

const PAGE_MARGIN = 48;
const COLUMN_GAP = 36;
const BODY_SIZE = 10;
const BODY_LINE = 15;
const TITLE_SIZE = 16;
const FOOTER_SIZE = 8;
const CAPTION_SIZE = 8;
const CAPTION_LINE = 12;
const ROLE_SIZE = 9;
const ROLE_LINE = 13;
const GREY = 110;
const RED_R = 204;
const RED_G = 0;
const RED_B = 0;
const SLOT_HEIGHT = 34;
const IMAGE_HEIGHT = 30;
const ROW_GAP = 16;
const NAME_GAP = 15;
const ROLE_GAP = 4;
const LOGO_HEIGHT = 40;
const LOGO_MAX_WIDTH = 160;
const ACK_TEXT =
    "I hereby acknowledge and commit to fully comply with all required clearances and to settle any accountabilities in accordance with company policies and procedures";
const SIGN_CAPTION = "Signature over printed Name/Date";

function sniffImageFormat(dataUrl: string): string | null {
    if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) {
        return "JPEG";
    }
    if (dataUrl.startsWith("data:image/png")) {
        return "PNG";
    }
    return null;
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

export function renderClearanceDocument(input: ClearancePrintInput): jsPDF {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const columnWidth = (contentWidth - COLUMN_GAP) / 2;
    const rightEdge = pageWidth - PAGE_MARGIN;
    const bottomLimit = pageHeight - PAGE_MARGIN - 20;
    let y = PAGE_MARGIN;

    function ensureSpace(needed: number): void {
        if (y + needed > bottomLimit) {
            doc.addPage();
            y = PAGE_MARGIN;
        }
    }

    function drawField(label: string, value: string, x: number, width: number, baseline: number): void {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        doc.text(label, x, baseline);
        const labelWidth = doc.getTextWidth(label);
        const valueX = x + labelWidth + 6;
        const valueWidth = value === "" ? 0 : doc.getTextWidth(value);
        if (value !== "") {
            doc.text(value, valueX, baseline);
        }
        const needed = labelWidth + 6 + Math.max(valueWidth, 120) + 12;
        const endX = Math.min(x + width, x + needed);
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(x, baseline + 4, endX, baseline + 4);
    }

    function leftHeight(entry: ClearancePrintEntry): number {
        const nameCount =
            entry.signeeName === ""
                ? 1
                : (doc.splitTextToSize(entry.signeeName, columnWidth) as string[]).length;
        const roleCount = Math.max(
            1,
            (doc.splitTextToSize(entry.category, columnWidth) as string[]).length
        );
        return SLOT_HEIGHT + NAME_GAP + nameCount * BODY_LINE + CAPTION_LINE + ROLE_GAP + roleCount * ROLE_LINE;
    }

    function rightHeight(remarks: string): number {
        if (remarks === "") return 70;
        const textCount = (doc.splitTextToSize(remarks, columnWidth) as string[]).length;
        return 14 + textCount * BODY_LINE + 34;
    }

    function renderLeft(entry: ClearancePrintEntry, x: number, top: number): void {
        const centerX = x + columnWidth / 2;
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
                doc.text(line, centerX, cursor, { align: "center" });
                cursor += BODY_LINE;
            }
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(CAPTION_SIZE);
        doc.setTextColor(GREY);
        doc.text(SIGN_CAPTION, centerX, cursor, { align: "center" });
        cursor += CAPTION_LINE + ROLE_GAP;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(ROLE_SIZE);
        doc.setTextColor(0);
        const roleLines = doc.splitTextToSize(entry.category, columnWidth) as string[];
        for (const line of roleLines) {
            doc.text(line, centerX, cursor, { align: "center" });
            cursor += ROLE_LINE;
        }
    }

    function renderRight(remarks: string, x: number, top: number): void {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        doc.text("Remarks:", x, top + 14);
        doc.setFont("helvetica", "normal");
        let ruleY: number;
        if (remarks === "") {
            ruleY = top + 46;
        } else {
            const lines = doc.splitTextToSize(remarks, columnWidth) as string[];
            let cursor = top + 29;
            for (const line of lines) {
                doc.text(line, x, cursor);
                cursor += BODY_LINE;
            }
            ruleY = cursor + 10;
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(x, ruleY, x + columnWidth, ruleY);
        doc.line(x, ruleY + 16, x + columnWidth, ruleY + 16);
    }

    const logoDataUrl = input.logo_data_url ?? null;
    const companyName = input.company_name ?? "";
    const companyAddress = input.company_address ?? "";
    const logoFormat = logoDataUrl === null ? null : sniffImageFormat(logoDataUrl);
    let logoHeight = 0;
    let headerTextX = PAGE_MARGIN;
    if (logoDataUrl !== null && logoFormat !== null) {
        try {
            const props = doc.getImageProperties(logoDataUrl);
            const ratio = props.width / props.height;
            let logoWidth = LOGO_HEIGHT * ratio;
            let scaledHeight = LOGO_HEIGHT;
            if (logoWidth > LOGO_MAX_WIDTH) {
                logoWidth = LOGO_MAX_WIDTH;
                scaledHeight = logoWidth / ratio;
            }
            doc.addImage(logoDataUrl, logoFormat, PAGE_MARGIN, y, logoWidth, scaledHeight);
            headerTextX = PAGE_MARGIN + logoWidth + 12;
            logoHeight = scaledHeight;
        } catch {
            headerTextX = PAGE_MARGIN;
            logoHeight = 0;
        }
    }
    let headerTextHeight = 0;
    if (companyName !== "") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(0);
        const nameLines = doc.splitTextToSize(companyName, rightEdge - headerTextX) as string[];
        doc.text(nameLines, headerTextX, y + 14);
        headerTextHeight += nameLines.length * 16;
    }
    if (companyAddress !== "") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0);
        const addressLines = doc.splitTextToSize(companyAddress, rightEdge - headerTextX) as string[];
        doc.text(addressLines, headerTextX, y + 14 + headerTextHeight);
        headerTextHeight += addressLines.length * 12 + 4;
    }
    const letterheadHeight = Math.max(logoHeight, headerTextHeight);
    if (letterheadHeight > 0) {
        y += letterheadHeight + 12;
    }

    const refValue = input.refNo ?? "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(RED_R, RED_G, RED_B);
    const refLabel = "REF No.";
    const refLabelWidth = doc.getTextWidth(refLabel);
    const refValueWidth = Math.max(120, doc.getTextWidth(refValue));
    const refValueX = rightEdge - refValueWidth;
    doc.text(refLabel, refValueX - 6 - refLabelWidth, y);
    doc.setTextColor(0);
    if (refValue !== "") {
        doc.text(refValue, refValueX, y);
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(refValueX, y + 4, rightEdge, y + 4);
    y += 24;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(0);
    doc.text("CLEARANCE FORM", pageWidth / 2, y, { align: "center" });
    y += 22;

    drawField("Name:", input.employeeName, PAGE_MARGIN, contentWidth, y);
    y += 22;
    const halfWidth = (contentWidth - COLUMN_GAP) / 2;
    drawField("Date:", input.date ?? "", PAGE_MARGIN, halfWidth, y);
    drawField("Position:", input.position ?? "", PAGE_MARGIN + halfWidth + COLUMN_GAP, halfWidth, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(0);
    const ackLines = doc.splitTextToSize(ACK_TEXT, contentWidth - 32) as string[];
    for (const line of ackLines) {
        ensureSpace(BODY_LINE);
        doc.text(line, pageWidth / 2, y, { align: "center" });
        y += BODY_LINE;
    }
    y += 10;

    const empLineWidth = 240;
    const empLineX = pageWidth / 2 - empLineWidth / 2;
    ensureSpace(24 + CAPTION_LINE + 8);
    const empLineY = y + 24;
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(empLineX, empLineY, empLineX + empLineWidth, empLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAPTION_SIZE);
    doc.setTextColor(GREY);
    doc.text(SIGN_CAPTION, pageWidth / 2, empLineY + 14, { align: "center" });
    y = empLineY + 14 + CAPTION_LINE + 6;

    ensureSpace(16);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([6, 4], 0);
    doc.line(PAGE_MARGIN, y, rightEdge, y);
    doc.setLineDashPattern([], 0);
    y += 18;

    if (input.entries.length === 0) {
        ensureSpace(BODY_LINE);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(BODY_SIZE);
        doc.setTextColor(0);
        doc.text("No categories on this clearance.", PAGE_MARGIN, y);
        y += BODY_LINE + ROW_GAP;
    }

    for (const entry of input.entries) {
        const rowHeight = Math.max(leftHeight(entry), rightHeight(entry.remarks)) + ROW_GAP;
        ensureSpace(rowHeight);
        renderLeft(entry, PAGE_MARGIN, y);
        renderRight(entry.remarks, PAGE_MARGIN + columnWidth + COLUMN_GAP, y);
        y += rowHeight;
    }

    const gmLineWidth = 240;
    const gmLineX = pageWidth / 2 - gmLineWidth / 2;
    const gmName = (input.gmName ?? "").trim();
    const gmTitle = (input.gmTitle ?? "").trim();
    const gmNameLines = gmName === "" ? [] : (doc.splitTextToSize(gmName, gmLineWidth) as string[]);
    const gmTitleLines = gmTitle === "" ? [] : (doc.splitTextToSize(gmTitle, gmLineWidth) as string[]);
    const gmNameHeight = gmNameLines.length > 0 ? gmNameLines.length * BODY_LINE : BODY_LINE;
    const gmTitleHeight = gmTitleLines.length > 0 ? gmTitleLines.length * ROLE_LINE : ROLE_LINE;
    ensureSpace(24 + gmNameHeight + CAPTION_LINE + ROLE_GAP + gmTitleHeight + 8);
    const gmLineY = y + 24;
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(gmLineX, gmLineY, gmLineX + gmLineWidth, gmLineY);
    let gmCursor = gmLineY + NAME_GAP;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.setTextColor(0);
    if (gmNameLines.length === 0) {
        gmCursor += BODY_LINE;
    } else {
        for (const line of gmNameLines) {
            doc.text(line, pageWidth / 2, gmCursor, { align: "center" });
            gmCursor += BODY_LINE;
        }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAPTION_SIZE);
    doc.setTextColor(GREY);
    doc.text(SIGN_CAPTION, pageWidth / 2, gmCursor, { align: "center" });
    gmCursor += CAPTION_LINE + ROLE_GAP;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(ROLE_SIZE);
    doc.setTextColor(0);
    if (gmTitleLines.length === 0) {
        gmCursor += ROLE_LINE;
    } else {
        for (const line of gmTitleLines) {
            doc.text(line, pageWidth / 2, gmCursor, { align: "center" });
            gmCursor += ROLE_LINE;
        }
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
    return doc;
}

export function buildClearancePdf(input: ClearancePrintInput): Blob {
    return renderClearanceDocument(input).output("blob");
}

export function buildClearancePdfBytes(input: ClearancePrintInput): Uint8Array {
    return new Uint8Array(renderClearanceDocument(input).output("arraybuffer"));
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
