import { GState, jsPDF } from "jspdf";

import {
    TURNOVER_CERTIFICATION_TEXT,
    TURNOVER_GENERAL_FIELDS,
    TURNOVER_SECTIONS,
    type TurnoverData,
    type TurnoverItemValue,
    type TurnoverPrintInput,
    type TurnoverSection,
    turnoverOfficerKey,
} from "../types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_BOTTOM = PAGE_HEIGHT - 56;
const FOOTER_Y = PAGE_HEIGHT - 22;
const TITLE_SIZE = 16;
const LETTERHEAD_NAME_SIZE = 15;
const LETTERHEAD_META_SIZE = 9;
const SECTION_SIZE = 11.5;
const BODY_SIZE = 9.5;
const HEADER_SIZE = 8.5;
const CAPTION_SIZE = 8;
const LINE_LEADING = 11.5;
const ROW_MIN_HEIGHT = 17;
const ROW_PAD_Y = 4.5;
const CELL_PAD_X = 5;
const ITEM_COL_WIDTH = 236;
const STATUS_COL_WIDTH = 88;
const REMARKS_COL_WIDTH = CONTENT_WIDTH - ITEM_COL_WIDTH - STATUS_COL_WIDTH;
const CHECK_SIZE = 9.5;
const GREY = 120;
const RULE_GREY = 150;
const FIELD_LINE_WIDTH = 200;
const SIGNATURE_LINE_WIDTH = 190;
const OFFICER_BLOCK_GAP = 40;
const OFFICER_BLOCK_STEP = 60;
const OFFICER_BLOCK_TAIL = 30;
const WATERMARK_MAX_WIDTH = 460;
const WATERMARK_MAX_HEIGHT = 330;
const WATERMARK_OPACITY = 0.14;
const LETTERHEAD_LOGO_MAX_WIDTH = 150;
const LETTERHEAD_LOGO_MAX_HEIGHT = 58;

const STATUS_COL_X = MARGIN + ITEM_COL_WIDTH;
const REMARKS_COL_X = MARGIN + ITEM_COL_WIDTH + STATUS_COL_WIDTH;

interface TurnoverLetterhead {
    company_name: string;
    company_address?: string | null;
    company_contact?: string | null;
    company_email?: string | null;
    logo_data_url?: string | null;
}

function setNormal(doc: jsPDF, size: number): void {
    doc.setFont("times", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0);
}

function setBold(doc: jsPDF, size: number): void {
    doc.setFont("times", "bold");
    doc.setFontSize(size);
    doc.setTextColor(0);
}

function wrap(doc: jsPDF, text: string, width: number): string[] {
    if (text.trim() === "") return [];
    return doc.splitTextToSize(text, width) as string[];
}

function drawRule(doc: jsPDF, y: number, grey = 0, width = 0.75): void {
    doc.setDrawColor(grey);
    doc.setLineWidth(width);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
    if (y + needed > BODY_BOTTOM) {
        doc.addPage();
        return MARGIN;
    }
    return y;
}

function drawHeading(doc: jsPDF, text: string, y: number, centred = false): number {
    setBold(doc, SECTION_SIZE);
    const x = centred ? PAGE_WIDTH / 2 - doc.getTextWidth(text) / 2 : MARGIN;
    doc.text(text, x, y);
    const width = doc.getTextWidth(text);
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(x, y + 3, x + width, y + 3);
    return y + SECTION_SIZE + 8;
}

function drawGeneralField(doc: jsPDF, label: string, value: string, y: number): number {
    setBold(doc, BODY_SIZE);
    const text = `${label}:`;
    doc.text(text, MARGIN, y);
    const labelWidth = doc.getTextWidth(text);
    const valueX = MARGIN + labelWidth + 5;
    const trimmed = value.trim();
    if (trimmed !== "") {
        setNormal(doc, BODY_SIZE);
        doc.text(trimmed, valueX, y);
    } else {
        doc.setDrawColor(RULE_GREY);
        doc.setLineWidth(0.5);
        doc.line(valueX, y + 3, Math.min(valueX + FIELD_LINE_WIDTH, PAGE_WIDTH - MARGIN), y + 3);
    }
    return y + LINE_LEADING + 6;
}

function drawCheckbox(doc: jsPDF, x: number, y: number, done: boolean): void {
    doc.setDrawColor(0);
    doc.setLineWidth(0.6);
    doc.rect(x, y, CHECK_SIZE, CHECK_SIZE);
    if (!done) return;
    doc.setLineWidth(1.1);
    doc.line(x + 1.8, y + CHECK_SIZE * 0.55, x + CHECK_SIZE * 0.42, y + CHECK_SIZE * 0.84);
    doc.line(x + CHECK_SIZE * 0.42, y + CHECK_SIZE * 0.84, x + CHECK_SIZE - 1.4, y + CHECK_SIZE * 0.18);
    doc.setLineWidth(0.6);
}

function drawTableHeader(doc: jsPDF, section: TurnoverSection, y: number): number {
    setBold(doc, HEADER_SIZE);
    doc.text("Item", MARGIN + CELL_PAD_X, y + ROW_MIN_HEIGHT - 5);
    doc.text(section.columnLabel, STATUS_COL_X + CELL_PAD_X, y + ROW_MIN_HEIGHT - 5);
    doc.text("Remarks", REMARKS_COL_X + CELL_PAD_X, y + ROW_MIN_HEIGHT - 5);
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, y + ROW_MIN_HEIGHT, PAGE_WIDTH - MARGIN, y + ROW_MIN_HEIGHT);
    return y + ROW_MIN_HEIGHT;
}

function drawTableGuides(doc: jsPDF, y: number, height: number): void {
    doc.setDrawColor(RULE_GREY);
    doc.setLineWidth(0.4);
    doc.line(STATUS_COL_X, y, STATUS_COL_X, y + height);
    doc.line(REMARKS_COL_X, y, REMARKS_COL_X, y + height);
}

function drawSectionTable(
    doc: jsPDF,
    section: TurnoverSection,
    data: TurnoverData,
    startY: number,
    reserveAfterLastRow: number
): number {
    let y = startY;
    y = drawTableHeader(doc, section, y);
    let itemIndex = 0;
    for (const item of section.items) {
        const value: TurnoverItemValue = data.items[item.id] ?? { done: false, remarks: "" };
        const labelLines = wrap(doc, item.label, ITEM_COL_WIDTH - CELL_PAD_X * 2 - 4);
        const remarkLines = wrap(doc, value.remarks, REMARKS_COL_WIDTH - CELL_PAD_X * 2 - 2);
        const rowHeight = Math.max(
            ROW_MIN_HEIGHT,
            labelLines.length * LINE_LEADING + ROW_PAD_Y * 2,
            remarkLines.length * LINE_LEADING + ROW_PAD_Y * 2
        );
        const isLast = itemIndex === section.items.length - 1;
        const needed = rowHeight + (isLast ? reserveAfterLastRow : 0);
        if (y + needed > BODY_BOTTOM) {
            doc.addPage();
            y = drawTableHeader(doc, section, MARGIN);
        }
        drawTableGuides(doc, y, rowHeight);
        setNormal(doc, BODY_SIZE);
        let labelY = y + ROW_PAD_Y + BODY_SIZE - 1;
        for (const line of labelLines) {
            doc.text(line, MARGIN + CELL_PAD_X, labelY);
            labelY += LINE_LEADING;
        }
        drawCheckbox(doc, STATUS_COL_X + 12, y + ROW_PAD_Y, value.done);
        if (remarkLines.length > 0) {
            let remarkY = y + ROW_PAD_Y + BODY_SIZE - 1;
            for (const line of remarkLines) {
                doc.text(line, REMARKS_COL_X + CELL_PAD_X, remarkY);
                remarkY += LINE_LEADING;
            }
        }
        doc.setDrawColor(RULE_GREY);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y + rowHeight, PAGE_WIDTH - MARGIN, y + rowHeight);
        y += rowHeight;
        itemIndex += 1;
    }
    return y;
}

function drawOfficerBlocks(
    doc: jsPDF,
    section: TurnoverSection,
    data: TurnoverData,
    startY: number
): number {
    const blockHeight =
        OFFICER_BLOCK_GAP + (section.officers.length - 1) * OFFICER_BLOCK_STEP + OFFICER_BLOCK_TAIL;
    let y = startY + OFFICER_BLOCK_GAP;
    if (startY + blockHeight > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN + OFFICER_BLOCK_GAP;
    }
    for (let index = 0; index < section.officers.length; index += 1) {
        if (index > 0) {
            y += OFFICER_BLOCK_STEP;
        }
        const officer = section.officers[index];
        const name = (data.officers[turnoverOfficerKey(section.id, index)] ?? "").trim();
        setBold(doc, BODY_SIZE);
        const label = `${officer}: `;
        doc.text(label, MARGIN, y);
        const lineX = MARGIN + doc.getTextWidth(label) + 3;
        const lineEnd = Math.min(lineX + SIGNATURE_LINE_WIDTH, PAGE_WIDTH - MARGIN);
        if (name !== "") {
            setNormal(doc, BODY_SIZE);
            doc.text(name, lineX, y);
        }
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(lineX, y + 3, lineEnd, y + 3);
        setNormal(doc, CAPTION_SIZE);
        doc.text("Signature Over Printed Name", lineX, y + 13);
    }
    return y + OFFICER_BLOCK_TAIL;
}

function writeParagraph(doc: jsPDF, text: string, y: number, maxWidth: number, size = BODY_SIZE): number {
    setNormal(doc, size);
    const lines = wrap(doc, text, maxWidth);
    let cursor = y;
    for (const line of lines) {
        cursor = ensureSpace(doc, cursor, LINE_LEADING);
        doc.text(line, MARGIN, cursor);
        cursor += LINE_LEADING;
    }
    return cursor;
}

function drawCertificationField(doc: jsPDF, label: string, value: string, y: number): number {
    setBold(doc, BODY_SIZE);
    const text = `${label}:`;
    doc.text(text, MARGIN, y);
    const labelWidth = doc.getTextWidth(text);
    const valueX = MARGIN + labelWidth + 5;
    const ruleEnd = Math.min(valueX + FIELD_LINE_WIDTH, PAGE_WIDTH - MARGIN);
    const trimmed = value.trim();
    if (trimmed !== "") {
        setNormal(doc, BODY_SIZE);
        doc.text(trimmed, valueX, y);
    }
    doc.setDrawColor(RULE_GREY);
    doc.setLineWidth(0.5);
    doc.line(valueX, y + 3, ruleEnd, y + 3);
    return y + LINE_LEADING + 8;
}

function drawFooters(doc: jsPDF): void {
    const total = doc.getNumberOfPages();
    for (let page = 1; page <= total; page += 1) {
        doc.setPage(page);
        doc.setFont("times", "normal");
        doc.setFontSize(CAPTION_SIZE);
        doc.setTextColor(GREY);
        doc.text(`${page} | P a g e`, PAGE_WIDTH - MARGIN, FOOTER_Y, { align: "right" });
    }
    doc.setTextColor(0);
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
            doc.addImage(
                logoDataUrl,
                format,
                (PAGE_WIDTH - width) / 2,
                (PAGE_HEIGHT - height) / 2,
                width,
                height
            );
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

function drawLetterhead(doc: jsPDF, company: TurnoverLetterhead, y: number): number {
    const logo = company.logo_data_url ?? "";
    if (logo !== "") {
        tryPlaceLogo(doc, logo, MARGIN, y);
    }
    const rightEdge = PAGE_WIDTH - MARGIN;
    const textCenterX =
        logo !== "" ? (MARGIN + LETTERHEAD_LOGO_MAX_WIDTH + 12 + rightEdge) / 2 : PAGE_WIDTH / 2;
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
    doc.line(MARGIN, ruleY, PAGE_WIDTH - MARGIN, ruleY);
    return ruleY + 18;
}

export function buildTurnoverPrintPdfBytes(input: TurnoverPrintInput): Uint8Array {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const data = input.data;
    let y = MARGIN + 6;

    const companyName = (input.companyName ?? "").trim();
    if (companyName !== "") {
        y = drawLetterhead(
            doc,
            {
                company_name: companyName,
                company_address: input.company_address ?? null,
                company_contact: input.company_contact ?? null,
                company_email: input.company_email ?? null,
                logo_data_url: input.logoDataUrl ?? null,
            },
            y
        );
    }

    doc.setFont("times", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(0);
    const title = "TURNOVER CHECKLIST";
    doc.text(title, PAGE_WIDTH / 2, y, { align: "center" });
    const titleWidth = doc.getTextWidth(title);
    doc.setDrawColor(0);
    doc.setLineWidth(1);
    doc.line(PAGE_WIDTH / 2 - titleWidth / 2, y + 4, PAGE_WIDTH / 2 + titleWidth / 2, y + 4);
    y += TITLE_SIZE + 12;

    const refNo = (input.refNo ?? "").trim();
    if (refNo !== "") {
        setNormal(doc, BODY_SIZE);
        doc.text(`REF NO: ${refNo}`, PAGE_WIDTH - MARGIN, y, { align: "right" });
        y += LINE_LEADING + 4;
    }

    y = ensureSpace(doc, y, 40);
    y = drawHeading(doc, "GENERAL INFORMATION", y);
    for (const field of TURNOVER_GENERAL_FIELDS) {
        y = ensureSpace(doc, y, LINE_LEADING + 6);
        y = drawGeneralField(doc, field.label, data.general[field.key], y);
    }
    y += 4;
    drawRule(doc, y, 0, 1);
    y += 16;

    for (const section of TURNOVER_SECTIONS) {
        y = ensureSpace(doc, y, 60);
        const heading = section.number === null ? section.title : `${section.number}. ${section.title}`;
        y = drawHeading(doc, heading, y);
        const officerBlockHeight = OFFICER_BLOCK_GAP + section.officers.length * OFFICER_BLOCK_STEP;
        y = drawSectionTable(doc, section, data, y, officerBlockHeight);
        y = drawOfficerBlocks(doc, section, data, y);
        y += 12;
        drawRule(doc, y, GREY, 0.6);
        y += 16;
    }

    y = ensureSpace(doc, y, 80);
    y = drawHeading(doc, "CERTIFICATION", y);
    y = writeParagraph(doc, TURNOVER_CERTIFICATION_TEXT, y, CONTENT_WIDTH);
    y += 12;
    y = ensureSpace(doc, y, (LINE_LEADING + 8) * 3);
    y = drawCertificationField(doc, "Employee Name", data.certification.employee_name, y);
    y = drawCertificationField(doc, "Signature", "", y);
    y = drawCertificationField(doc, "Date", data.certification.date, y);

    drawWatermark(doc, input.logoDataUrl);
    drawFooters(doc);
    return new Uint8Array(doc.output("arraybuffer"));
}
