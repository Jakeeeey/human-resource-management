import { GState, jsPDF } from "jspdf";

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
    company_contact?: string | null;
    company_email?: string | null;
    logo_data_url?: string | null;
    gmName?: string;
    gmTitle?: string;
}

interface ClearanceLetterhead {
    company_name: string;
    company_address?: string | null;
    company_contact?: string | null;
    company_email?: string | null;
    logo_data_url?: string | null;
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
const LETTERHEAD_NAME_SIZE = 15;
const LETTERHEAD_META_SIZE = 9;
const ACK_TEXT =
    "I hereby acknowledge and commit to fully comply with all required clearances and to settle any accountabilities in accordance with company policies and procedures";
const SIGN_CAPTION = "Signature over printed Name/Date";
const WATERMARK_MAX_WIDTH = 460;
const WATERMARK_MAX_HEIGHT = 330;
const WATERMARK_OPACITY = 0.14;
const LETTERHEAD_LOGO_MAX_WIDTH = 150;
const LETTERHEAD_LOGO_MAX_HEIGHT = 58;

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

function drawLetterhead(doc: jsPDF, company: ClearanceLetterhead, y: number): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    const logo = company.logo_data_url ?? "";
    if (logo !== "") {
        tryPlaceLogo(doc, logo, PAGE_MARGIN, y);
    }
    const rightEdge = pageWidth - PAGE_MARGIN;
    const textCenterX =
        logo !== "" ? (PAGE_MARGIN + LETTERHEAD_LOGO_MAX_WIDTH + 12 + rightEdge) / 2 : pageWidth / 2;
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
    doc.line(PAGE_MARGIN, ruleY, pageWidth - PAGE_MARGIN, ruleY);
    return ruleY + 18;
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

    const companyName = input.company_name ?? "";
    if (companyName !== "") {
        y = drawLetterhead(
            doc,
            {
                company_name: companyName,
                company_address: input.company_address ?? "",
                company_contact: input.company_contact ?? "",
                company_email: input.company_email ?? "",
                logo_data_url: input.logo_data_url ?? "",
            },
            y
        );
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

    drawWatermark(doc, input.logo_data_url ?? null);

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
