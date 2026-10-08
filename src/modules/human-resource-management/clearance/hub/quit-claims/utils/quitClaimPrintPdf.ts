import { jsPDF } from "jspdf";
import { __createTable, __drawTable } from "jspdf-autotable";
import type { RowInput, UserOptions } from "jspdf-autotable";

import type {
    QuitClaimAccountability,
    QuitClaimAcknowledgement,
    QuitClaimDeduction,
    QuitClaimDueToEmployee,
    QuitClaimSection2Signatory,
    QuitClaimValues,
} from "../types";

export interface QuitClaimCompany {
    company_name: string;
    company_address?: string | null;
    company_contact?: string | null;
    company_email?: string | null;
    logo_data_url?: string | null;
}

interface UnderlineRun {
    text: string;
    underline: boolean;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 936;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_BOTTOM = PAGE_HEIGHT - 64;
const FOOTER_Y = PAGE_HEIGHT - 24;
const TITLE_SIZE = 15;
const SECTION_SIZE = 13;
const BODY_SIZE = 11;
const BODY_LEADING = 16.5;
const FIELD_SIZE = 11;
const FIELD_LEADING = 16.5;
const FIELD_AFTER = 19;
const CAPTION_SIZE = 9;
const SIG_CAPTION_SIZE = 11;
const SIG_SPACE_ABOVE = 16;
const RULE_CAPTION_GAP = 13;
const AFTER_SIG_BLOCK = 14;
const NET_LABEL_SIZE = 11;
const NET_VALUE_SIZE = 17;
const TABLE_ROW_HEIGHT = 18;
const TABLE_PAD_X = 6;
const TITLE_TRACKING = 2;
const FIRST_LINE_INDENT = 36;
const PAYMENT_VALUE_X = 284;
const PAYMENT_VALUE_SIZE = 20;
const PAYMENT_BLANK_WIDTH = 81;
const SIDE_BLOCK_WIDTH = 220;
const SIDE_BLOCK_X = PAGE_WIDTH - MARGIN - 20 - SIDE_BLOCK_WIDTH;
const GREY = 110;
const ACCOUNTABILITY_MIN_ROWS = 5;
const DEDUCTION_MIN_ROWS = 3;
const DUE_MIN_ROWS = 3;
const FALLBACK_COMPANY = "VERTEX TECHNOLOGIES CORPORATION";

const LONG_MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function formatMoney(value: string): string {
    const compact = value.trim().replace(/,/g, "");
    if (compact === "") {
        return "";
    }
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(compact)) {
        return value;
    }
    const rounded = Number(compact).toFixed(2);
    const negative = rounded.startsWith("-");
    const parts = (negative ? rounded.slice(1) : rounded).split(".");
    const grouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${negative ? "-" : ""}${grouped}.${parts[1]}`;
}

function formatLongDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) return value;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return value;
    return `${LONG_MONTHS[month - 1]} ${String(day).padStart(2, "0")}, ${year}`;
}

const CLEARANCE_PARAGRAPHS: string[] = [
    "All clearing officers and Accounts covered should indicate on this form all employees’ accountabilities within respective offices.",
    "This form shall route to the clearing officer/offices one after the other. The last clearing officer (coordinator) shall be responsible in furnishing the copies to the employee, employee’s 201 file and disbursing officer concerned.",
    "No terminal payment shall be made by any disbursing officer unless he has received his copy of the duly accomplished clearance certificate, and the employee has shown proof that he has settled all the accountabilities indicated there under.",
    "All clearing officers shall see to it that no further purchases, loans and/or issuances shall be given to the above-named employee after clearing date.",
    "Please do not delay the routine of this form.",
];

function deductionAuthorisation(companyName: string): string {
    return `I hereby authorize ${companyName} to deduct from my salary and other remuneration any/or all money/accountabilities due to the company as enumerated.`;
}

const RELEASE_PRE_1 =
    "I hereby acknowledge the receipt of the original clearance and all payments due to me. I hereby release and forever discharge ";

const RELEASE_POST_1 =
    " of all claims and demands of any kind, known or unknown, arising from my employment with the company, including but not limited to salaries, wages, benefits, reimbursements, and any other monetary or non-monetary claims.";

const RELEASE_P2 =
    "I execute this Release and Quitclaim voluntarily, with full knowledge of its legal consequences, and confirm that I have no further claims against the Company";

const CERTIFYING_SENTENCE =
    "This is to certify that the above name employee has been cleared of all money/ records/ equipment/ tools/ supplies accountabilities as date indicated.";

const CC_LINE = "Cc: Employee / 201 file / DOLE";
const CC_INDENT = 36;
const CC_LEADING = 15;

const REPUBLIC_LINE_1 = "REPUBLIC OF THE PHILIPPINES )";

const ACK_CITY_BLANK = "__________________";
const ACK_LONG_BLANK = "______________________________";
const ACK_DAY_BLANK = "___";
const ACK_MONTH_BLANK = "_______";
const ACK_PLACE_BLANK = "__________";
const ACK_REG_BLANK = "____";

function ackFill(value: string | undefined, blank: string): string {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? blank : trimmed;
}

function republicLine2(city: string | undefined): string {
    return `CITY/MUNICIPALITY OF ${ackFill(city, ACK_CITY_BLANK)} ) S.S.`;
}

function juratText(ack: QuitClaimAcknowledgement | undefined): string {
    const place = ackFill(ack?.city, ACK_LONG_BLANK);
    const appeared = ackFill(ack?.appeared_name, ACK_LONG_BLANK);
    const idType = ackFill(ack?.id_type, ACK_LONG_BLANK);
    const idNo = ackFill(ack?.id_no, ACK_LONG_BLANK);
    return `BEFORE ME, a Notary Public for and in ${place}, personally appeared ${appeared}, with valid government-issued ID ${idType}, with ID No. ${idNo}, known to me to be the same person who executed the foregoing Release and Quitclaim, and acknowledged to me that the same is his/her free and voluntary act and deed.`;
}

function witnessText(ack: QuitClaimAcknowledgement | undefined): string {
    const day = ackFill(ack?.witness_day, ACK_DAY_BLANK);
    const month = ackFill(ack?.witness_month, ACK_MONTH_BLANK);
    const place = ackFill(ack?.witness_place, ACK_PLACE_BLANK);
    return `IN WITNESS WHEREOF, I have hereunto set my hand and affixed my notarial seal this ${day} day of ${month}, 20, at ${place}, Philippines.`;
}

function registryLines(ack: QuitClaimAcknowledgement | undefined): string[] {
    return [
        `Doc. No. ${ackFill(ack?.doc_no, ACK_REG_BLANK)};`,
        `Page No. ${ackFill(ack?.page_no, ACK_REG_BLANK)};`,
        `Book No. ${ackFill(ack?.book_no, ACK_REG_BLANK)};`,
        `Series of ${ackFill(ack?.series, ACK_REG_BLANK)}.`,
    ];
}

function tryPlaceLogo(doc: jsPDF, dataUrl: string, x: number, y: number): void {
    try {
        const props = doc.getImageProperties(dataUrl);
        const height = 44;
        const width = Math.min(130, (props.width / props.height) * height);
        const format = dataUrl.indexOf("data:image/jpeg") === 0 ? "JPEG" : "PNG";
        doc.addImage(dataUrl, format, x, y, width, height);
    } catch {
        return;
    }
}

function drawLetterhead(doc: jsPDF, company: QuitClaimCompany, y: number): number {
    const logo = company.logo_data_url ?? "";
    if (logo !== "") {
        tryPlaceLogo(doc, logo, MARGIN, y);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(TITLE_SIZE);
    doc.setTextColor(0);
    doc.text(company.company_name, PAGE_WIDTH / 2, y + 14, { align: "center" });
    let cursor = y + 32;
    doc.setFont("helvetica", "bolditalic");
    doc.setFontSize(9);
    const address = company.company_address ?? "";
    if (address !== "") {
        doc.text(address, PAGE_WIDTH / 2, cursor, { align: "center" });
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
        doc.text(contactParts.join(" | "), PAGE_WIDTH / 2, cursor, { align: "center" });
        cursor += 13;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, cursor + 4, PAGE_WIDTH - MARGIN, cursor + 4);
    return cursor + 22;
}

function drawTitle(
    doc: jsPDF,
    text: string,
    y: number,
    size: number,
    font = "times",
    style = "bold",
    underline = false,
    tracking = 0,
    alignLeft = false
): number {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(0);
    if (tracking > 0) {
        let total = 0;
        for (const ch of text) {
            total += wordAdvance(doc, ch) + tracking;
        }
        total -= tracking;
        const startX = alignLeft ? MARGIN : PAGE_WIDTH / 2 - total / 2;
        let cursorX = startX;
        for (const ch of text) {
            doc.text(ch, cursorX, y);
            cursorX += wordAdvance(doc, ch) + tracking;
        }
        if (underline) {
            doc.setDrawColor(0);
            doc.setLineWidth(2);
            doc.line(startX, y + 3, startX + total, y + 3);
        }
        return y + size + 7;
    }
    doc.text(text, PAGE_WIDTH / 2, y, { align: "center" });
    if (underline) {
        const width = doc.getTextWidth(text);
        doc.setDrawColor(0);
        doc.setLineWidth(1);
        doc.line(PAGE_WIDTH / 2 - width / 2, y + 3, PAGE_WIDTH / 2 + width / 2, y + 3);
    }
    return y + size + 7;
}

function drawCaption(doc: jsPDF, text: string, y: number): number {
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(text, MARGIN, y);
    return y + 16;
}

function drawCcBlock(doc: jsPDF, y: number): number {
    const segments = CC_LINE.split(/ \/ /).map((entry) => entry.trim());
    const head = segments[0];
    const mark = head.search(/:/);
    const label = mark >= 0 ? head.slice(0, mark + 1) : head;
    const first = mark >= 0 ? head.slice(mark + 1).trim() : head;
    drawCaption(doc, label, y);
    const indentX = MARGIN + CC_INDENT;
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(first, indentX, y);
    let cursor = y + CC_LEADING;
    for (const entry of segments.slice(1)) {
        doc.text(entry, indentX, cursor);
        cursor += CC_LEADING;
    }
    return cursor + 2;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): number {
    doc.setFont("times", "bold");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    const valueX = x + labelWidth + 6;
    doc.setFont("times", "normal");
    let cursor = y;
    let widest = 0;
    if (value !== "") {
        const lines = doc.splitTextToSize(value, Math.max(24, x + width - valueX));
        for (const line of lines) {
            doc.text(line, valueX, cursor);
            widest = Math.max(widest, doc.getTextWidth(line));
            cursor += FIELD_LEADING;
        }
        cursor -= FIELD_LEADING;
    }
    const needed = labelWidth + 6 + Math.max(widest, 120) + 12;
    const endX = Math.min(x + width, x + needed);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(x, cursor + 4, endX, cursor + 4);
    return cursor + FIELD_AFTER;
}

function wordAdvance(doc: jsPDF, word: string): number {
    let total = 0;
    for (const ch of word) {
        total += doc.getTextWidth(ch);
    }
    return total;
}

function wrapWords(doc: jsPDF, text: string, maxWidth: number, indent = 0): string[][] {
    const words = text.split(" ").filter((piece) => piece !== "");
    const lines: string[][] = [];
    let current: string[] = [];
    let currentWidth = 0;
    let limit = maxWidth - indent;
    const spaceWidth = doc.getTextWidth(" ");
    for (const word of words) {
        const width = wordAdvance(doc, word);
        if (current.length > 0 && currentWidth + spaceWidth + width > limit) {
            lines.push(current);
            current = [word];
            currentWidth = width;
            limit = maxWidth;
        } else {
            if (current.length > 0) {
                currentWidth += spaceWidth;
            }
            current.push(word);
            currentWidth += width;
        }
    }
    if (current.length > 0) {
        lines.push(current);
    }
    return lines;
}

function drawJustifiedLine(doc: jsPDF, words: string[], x: number, y: number, maxWidth: number): void {
    if (words.length < 2) {
        doc.text(words.join(" "), x, y);
        return;
    }
    const spaceWidth = doc.getTextWidth(" ");
    let contentWidth = 0;
    for (const word of words) {
        contentWidth += wordAdvance(doc, word);
    }
    const gaps = words.length - 1;
    const extra = (maxWidth - contentWidth - spaceWidth * gaps) / gaps;
    if (extra < 0) {
        doc.text(words.join(" "), x, y);
        return;
    }
    let cursorX = x;
    for (const word of words) {
        doc.text(word, cursorX, y);
        cursorX += wordAdvance(doc, word) + spaceWidth + extra;
    }
}

function writeParagraph(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number = BODY_SIZE,
    leading: number = BODY_LEADING,
    justify = false,
    indent: number = FIRST_LINE_INDENT
): number {
    doc.setFont("times", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0);
    if (!justify) {
        const lines = wrapWords(doc, text, maxWidth, indent);
        let cursor = y;
        lines.forEach((lineWords, index) => {
            if (cursor > BODY_BOTTOM) {
                doc.addPage();
                cursor = MARGIN;
            }
            doc.text(lineWords.join(" "), index === 0 ? x + indent : x, cursor);
            cursor += leading;
        });
        return cursor;
    }
    const lines = wrapWords(doc, text, maxWidth, indent);
    let cursor = y;
    lines.forEach((words, index) => {
        if (cursor > BODY_BOTTOM) {
            doc.addPage();
            cursor = MARGIN;
        }
        const first = index === 0;
        const lineX = first ? x + indent : x;
        const lineWidth = first ? maxWidth - indent : maxWidth;
        if (index < lines.length - 1) {
            drawJustifiedLine(doc, words, lineX, cursor, lineWidth);
        } else {
            doc.text(words.join(" "), lineX, cursor);
        }
        cursor += leading;
    });
    return cursor;
}

function writeRichParagraph(
    doc: jsPDF,
    runs: UnderlineRun[],
    x: number,
    y: number,
    maxWidth: number,
    size: number = BODY_SIZE,
    leading: number = BODY_LEADING,
    justify = false,
    indent: number = FIRST_LINE_INDENT
): number {
    const words: UnderlineRun[] = [];
    for (const run of runs) {
        for (const piece of run.text.split(" ")) {
            if (piece !== "") {
                words.push({ text: piece, underline: run.underline });
            }
        }
    }
    doc.setFont("times", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0);
    const spaceWidth = doc.getTextWidth(" ");
    const lines: UnderlineRun[][] = [];
    let current: UnderlineRun[] = [];
    let currentWidth = 0;
    let limit = maxWidth - indent;
    for (const word of words) {
        const width = wordAdvance(doc, word.text);
        if (current.length > 0 && currentWidth + spaceWidth + width > limit) {
            lines.push(current);
            current = [word];
            currentWidth = width;
            limit = maxWidth;
        } else {
            if (current.length > 0) {
                currentWidth += spaceWidth;
            }
            current.push(word);
            currentWidth += width;
        }
    }
    if (current.length > 0) {
        lines.push(current);
    }
    let cursorY = y;
    lines.forEach((line, index) => {
        if (cursorY > BODY_BOTTOM) {
            doc.addPage();
            cursorY = MARGIN;
        }
        const first = index === 0;
        const lineWidth = first ? maxWidth - indent : maxWidth;
        let gap = spaceWidth;
        if (justify && index < lines.length - 1 && line.length > 1) {
            let contentWidth = 0;
            for (const word of line) {
                contentWidth += wordAdvance(doc, word.text);
            }
            const extra = (lineWidth - contentWidth - spaceWidth * (line.length - 1)) / (line.length - 1);
            if (extra >= 0) {
                gap = spaceWidth + extra;
            }
        }
        let cursorX = first ? x + indent : x;
        const pending: { x: number; width: number }[] = [];
        line.forEach((word, wordIndex) => {
            if (wordIndex > 0) {
                cursorX += gap;
            }
            const width = wordAdvance(doc, word.text);
            doc.text(word.text, cursorX, cursorY);
            if (word.underline) {
                pending.push({ x: cursorX, width });
            }
            cursorX += width;
        });
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        for (const span of pending) {
            doc.line(span.x, cursorY + 2, span.x + span.width, cursorY + 2);
        }
        cursorY += leading;
    });
    return cursorY;
}

function drawSignatureLine(doc: jsPDF, x: number, y: number, width: number, value: string, caption: string): number {
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(x, y, x + width, y);
    const centerX = x + width / 2;
    let cursor = y + RULE_CAPTION_GAP;
    if (value !== "") {
        doc.setFont("times", "bold");
        doc.setFontSize(FIELD_SIZE);
        doc.setTextColor(0);
        doc.text(value, centerX, cursor, { align: "center" });
        cursor += 13;
    }
    doc.setFont("times", "normal");
    doc.setFontSize(SIG_CAPTION_SIZE);
    doc.setTextColor(0);
    doc.text(caption, centerX, cursor, { align: "center" });
    return cursor + AFTER_SIG_BLOCK;
}

function drawGridTable(
    doc: jsPDF,
    startY: number,
    head: string[],
    body: RowInput[],
    widths: (number | undefined)[]
): number {
    const columnStyles: NonNullable<UserOptions["columnStyles"]> = {};
    widths.forEach((width, index) => {
        if (width !== undefined) {
            columnStyles[String(index)] = { cellWidth: width };
        }
    });
    const table = __createTable(doc, {
        startY,
        margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: PAGE_HEIGHT - BODY_BOTTOM },
        theme: "grid",
        showHead: "everyPage",
        pageBreak: "auto",
        rowPageBreak: "auto",
        head: [head],
        body,
        styles: {
            font: "times",
            fontSize: 11,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
            cellPadding: { top: 3, right: TABLE_PAD_X, bottom: 3, left: TABLE_PAD_X },
            minCellHeight: TABLE_ROW_HEIGHT,
            valign: "middle",
        },
        headStyles: {
            fontStyle: "bold",
            halign: "center",
            fillColor: [255, 255, 255],
            fontSize: 11,
        },
        columnStyles,
    });
    __drawTable(doc, table);
    return (table.finalY ?? startY) + 4;
}

function padAccountabilities(rows: QuitClaimAccountability[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.outlet, row.name, row.date, "", row.remarks]);
    while (out.length < ACCOUNTABILITY_MIN_ROWS) {
        out.push(["", "", "", "", ""]);
    }
    return out;
}

function padDeductions(rows: QuitClaimDeduction[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.label, formatMoney(row.amount), ""]);
    while (out.length < DEDUCTION_MIN_ROWS) {
        out.push(["", "", ""]);
    }
    return out;
}

function padDueToEmployee(rows: QuitClaimDueToEmployee[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.item, row.days, formatMoney(row.amount)]);
    while (out.length < DUE_MIN_ROWS) {
        out.push(["", "", ""]);
    }
    return out;
}

function section2SignatoryName(signatories: QuitClaimSection2Signatory[], label: string): string {
    const found = signatories.find((entry) => entry.label === label);
    if (found === undefined) {
        return "";
    }
    return found.name;
}

function drawSection2Signatory(doc: jsPDF, x: number, y: number, width: number, name: string, title: string, centered: boolean): number {
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + width, y);
    let cursor = y + RULE_CAPTION_GAP;
    if (name !== "") {
        doc.setFont("times", "bold");
        doc.setFontSize(FIELD_SIZE);
        doc.setTextColor(0);
        if (centered) {
            doc.text(name, x + width / 2, cursor, { align: "center" });
        } else {
            doc.text(name, x, cursor);
        }
    }
    cursor += 13;
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    if (centered) {
        doc.text(title, x + width / 2, cursor, { align: "center" });
    } else {
        doc.text(title, x, cursor);
    }
    return cursor + 16;
}

function drawPaymentAmount(doc: jsPDF, y: number, value: string): number {
    doc.setFont("times", "bold");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text("Amount:", MARGIN, y);
    if (value === "") {
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(PAYMENT_VALUE_X, y + 4, PAYMENT_VALUE_X + PAYMENT_BLANK_WIDTH, y + 4);
        return y + FIELD_AFTER;
    }
    doc.setFont("times", "bold");
    doc.setFontSize(PAYMENT_VALUE_SIZE);
    doc.setTextColor(0);
    doc.text(value, PAYMENT_VALUE_X, y);
    const width = wordAdvance(doc, value);
    doc.setDrawColor(0);
    doc.setLineWidth(2);
    doc.line(PAYMENT_VALUE_X, y + 3, PAYMENT_VALUE_X + width, y + 3);
    return y + 30;
}

function drawPaymentBlank(doc: jsPDF, label: string, y: number, value: string): number {
    doc.setFont("times", "bold");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(label, MARGIN, y);
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    let ruleWidth = PAYMENT_BLANK_WIDTH;
    if (value !== "") {
        doc.text(value, PAYMENT_VALUE_X, y);
        ruleWidth = Math.max(PAYMENT_BLANK_WIDTH, wordAdvance(doc, value) + 12);
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(PAYMENT_VALUE_X, y + 4, PAYMENT_VALUE_X + ruleWidth, y + 4);
    return y + 17;
}

function drawReleaseBlock(doc: jsPDF, y: number, name: string, date: string): number {
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(SIDE_BLOCK_X, y, SIDE_BLOCK_X + SIDE_BLOCK_WIDTH, y);
    const centerX = SIDE_BLOCK_X + SIDE_BLOCK_WIDTH / 2;
    let cursor = y + RULE_CAPTION_GAP;
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text("Released/Disbursed By:/Date", centerX, cursor, { align: "center" });
    cursor += 13;
    if (name !== "") {
        doc.setFont("times", "bold");
        doc.setFontSize(FIELD_SIZE);
        doc.setTextColor(0);
        doc.text(name, centerX, cursor, { align: "center" });
        cursor += 13;
    }
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text("HR Officer", centerX, cursor, { align: "center" });
    cursor += 15;
    const dateLabel = "Date Signed:";
    doc.setFont("times", "bold");
    doc.setFontSize(FIELD_SIZE);
    const dateLabelX = SIDE_BLOCK_X + 46;
    doc.text(dateLabel, dateLabelX, cursor);
    const valueX = dateLabelX + wordAdvance(doc, dateLabel) + 8;
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    const dateRuleEnd = SIDE_BLOCK_X + SIDE_BLOCK_WIDTH - 4;
    if (date !== "") {
        doc.text(date, valueX, cursor);
    }
    const ruleEnd = date !== "" ? valueX + Math.max(60, wordAdvance(doc, date) + 12) : dateRuleEnd;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(valueX, cursor + 3, ruleEnd, cursor + 3);
    return cursor + 18;
}

function drawSection2Signatories(doc: jsPDF, values: QuitClaimValues, y: number): number {
    const signatories = values.section2_signatories ?? [];
    const payrollName = section2SignatoryName(signatories, "Payroll Officer");
    const treasuryName = section2SignatoryName(signatories, "Treasury Officer");
    const managerName = section2SignatoryName(signatories, "General Manager");
    const financeName = section2SignatoryName(signatories, "CFO");
    const executiveName = section2SignatoryName(signatories, "CEO");
    const verifiedLabel = "Amount verified by:";
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(verifiedLabel, MARGIN, y);
    const verifiedX = MARGIN + doc.getTextWidth(verifiedLabel) + 5;
    const verifiedWidth = 130;
    if (payrollName !== "") {
        doc.text(payrollName, verifiedX, y);
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(verifiedX, y + 3, verifiedX + verifiedWidth, y + 3);
    doc.text("Payroll Officer", verifiedX + verifiedWidth / 2, y + 13, { align: "center" });
    let cursor = y + 32;
    cursor = drawSection2Signatory(doc, MARGIN, cursor, 80, treasuryName, "Treasury Officer", false);
    cursor += 18;
    drawSection2Signatory(doc, MARGIN, cursor, 105, managerName, "General Manager", false);
    drawSection2Signatory(doc, 257, cursor, 100, financeName, "Chief Finance Officer", false);
    drawSection2Signatory(doc, 445, cursor, 95, executiveName, "Chief Executive Officer", true);
    return cursor + 40;
}

function drawFooters(doc: jsPDF): void {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("times", "normal");
        doc.setFontSize(CAPTION_SIZE);
        doc.setTextColor(GREY);
        doc.text(`Page ${page} of ${totalPages}`, PAGE_WIDTH / 2, FOOTER_Y, { align: "center" });
    }
    doc.setTextColor(0);
}

export function buildQuitClaimPdf(values: QuitClaimValues, company: QuitClaimCompany): Uint8Array {
    const doc = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PAGE_HEIGHT] });
    const resolvedCompany = company.company_name !== "" ? company.company_name : FALLBACK_COMPANY;
    let y = MARGIN;

    y = drawLetterhead(doc, company, y);
    y = drawTitle(doc, "EMPLOYEE CLEARANCE", y, TITLE_SIZE, "times", "bold", false);
    y = drawField(doc, "DATE:", values.identity.date, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "NAME:", values.identity.name, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "POSITION:", values.identity.position, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "DATE OF SEPARATION:", formatLongDate(values.identity.separation), MARGIN, y, CONTENT_WIDTH);
    y += 6;
    for (const paragraph of CLEARANCE_PARAGRAPHS) {
        y = writeParagraph(doc, paragraph, MARGIN, y, CONTENT_WIDTH);
        y += 4;
    }
    y += 2;
    if (y + SIG_SPACE_ABOVE + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const halfWidth = (CONTENT_WIDTH - 36) / 2;
    const managerY = y + SIG_SPACE_ABOVE;
    drawSignatureLine(doc, MARGIN + halfWidth + 36, managerY, halfWidth, values.manager_signature_date, "MANAGER’S SIGNATURE/DATE");
    y = managerY + 44;
    y = writeParagraph(doc, deductionAuthorisation(resolvedCompany), MARGIN, y, CONTENT_WIDTH);
    y += 10;
    if (y + SIG_SPACE_ABOVE + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const employeeWidth = 280;
    y += SIG_SPACE_ABOVE;
    y = drawSignatureLine(
        doc,
        PAGE_WIDTH / 2 - employeeWidth / 2,
        y,
        employeeWidth,
        values.identity.name,
        "Signature over Printed Name/ Date"
    );

    doc.addPage();
    y = MARGIN;
    y = drawLetterhead(doc, company, y);
    y = drawTitle(doc, "ACCOUNTABILITIES", y, SECTION_SIZE, "times", "normal", false);
    y = drawField(doc, "NAME:", values.identity.name, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "COMPANY:", resolvedCompany, MARGIN, y, CONTENT_WIDTH);
    y += 6;
    y = writeParagraph(doc, CERTIFYING_SENTENCE, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    if (y + 72 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawGridTable(
        doc,
        y,
        ["OUTLET", "NAME", "DATE", "SIGNATURE", "REMARKS"],
        padAccountabilities(values.accountabilities),
        [100, 130, 78, 96]
    );
    y += 8;
    y = drawCaption(doc, "Deductions", y);
    if (y + 72 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawGridTable(doc, y, ["", "AMOUNT", "CERTIFIED BY:"], padDeductions(values.deductions), [260, 110]);
    y += 8;
    y = drawCaption(doc, "DUE TO EMPLOYEE:", y);
    if (y + 72 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const dueRows = padDueToEmployee(values.due_to_employee);
    dueRows.push([
        { content: "TOTAL:", styles: { fontStyle: "bold", halign: "right" } },
        "",
        { content: formatMoney(values.totals.total), styles: { fontStyle: "bold" } },
    ]);
    dueRows.push([
        { content: "LESS: DEDUCTIONS", styles: { fontStyle: "bold", halign: "right" } },
        "",
        { content: formatMoney(values.totals.less_deductions), styles: { fontStyle: "bold" } },
    ]);
    y = drawGridTable(doc, y, ["ITEM", "NO. OF DAYS", "AMOUNT"], dueRows, [undefined, 110, 130]);
    y += TABLE_ROW_HEIGHT;
    if (y + 24 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const netLabel = "NET DUE TO EMPLOYEE:";
    doc.setFont("times", "bold");
    doc.setFontSize(NET_LABEL_SIZE);
    doc.setTextColor(0);
    doc.text(netLabel, MARGIN, y);
    const netRuleX = MARGIN + wordAdvance(doc, netLabel) + 10;
    doc.setFont("times", "bold");
    doc.setFontSize(NET_VALUE_SIZE);
    doc.setTextColor(0);
    const netValue = formatMoney(values.totals.net);
    if (netValue !== "") {
        doc.text(netValue, PAGE_WIDTH - MARGIN - TABLE_PAD_X, y, { align: "right" });
    } else {
        doc.setDrawColor(0);
        doc.setLineWidth(0.75);
        doc.line(netRuleX, y + 3, PAGE_WIDTH - MARGIN - TABLE_PAD_X, y + 3);
    }
    y += TABLE_ROW_HEIGHT * 1.75;
    if (y + 210 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawSection2Signatories(doc, values, y);

    doc.addPage();
    y = MARGIN;
    y = drawLetterhead(doc, company, y);
    y = drawTitle(doc, "RELEASE AND QUITCLAIM", y, TITLE_SIZE, "courier", "bold", true, TITLE_TRACKING, false);
    y = writeRichParagraph(
        doc,
        [
            { text: RELEASE_PRE_1, underline: false },
            { text: resolvedCompany, underline: true },
            { text: RELEASE_POST_1, underline: false },
        ],
        MARGIN,
        y,
        CONTENT_WIDTH,
        BODY_SIZE,
        BODY_LEADING,
        true
    );
    y += 4;
    y = writeParagraph(doc, RELEASE_P2, MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, true);
    y += 6;
    if (y + SIG_SPACE_ABOVE + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y += SIG_SPACE_ABOVE;
    y = drawSignatureLine(doc, SIDE_BLOCK_X, y, SIDE_BLOCK_WIDTH, values.identity.name, "Signature over Printed Name");
    doc.setFont("times", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    const signerDateLabel = "Date Signed:";
    const signerDateLabelWidth = wordAdvance(doc, signerDateLabel);
    const signerDateRuleEnd = SIDE_BLOCK_X + SIDE_BLOCK_WIDTH - 4;
    const signerDateRuleX = signerDateRuleEnd - 177;
    doc.text(signerDateLabel, signerDateRuleX - 8 - signerDateLabelWidth, y);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(signerDateRuleX, y + 3, signerDateRuleEnd, y + 3);
    y += 14;
    y = drawCaption(doc, "Record of payment:", y);
    y = drawPaymentAmount(doc, y, values.payment.amount);
    y = drawPaymentBlank(doc, "Check /Account #:", y, values.payment.check_no);
    y = drawPaymentBlank(doc, "Date:", y, values.payment.date);
    y += SIG_SPACE_ABOVE;
    y = drawReleaseBlock(doc, y, values.released_by.name, values.released_by.date);
    y += 2;
    y = drawCcBlock(doc, y);
    y += 6;
    if (y + 40 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(1.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 24;
    y = drawTitle(doc, "ACKNOWLEDGEMENT", y, 15, "times", "bold", true);
    y = writeParagraph(doc, "ACKNOWLEDGMENT", MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, false, 0);
    y = writeParagraph(doc, REPUBLIC_LINE_1, MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, false, 0);
    y = writeParagraph(doc, republicLine2(values.acknowledgement?.city), MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, false, 0);
    y += 4;
    y = writeParagraph(doc, juratText(values.acknowledgement), MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, true);
    y += 4;
    y = writeParagraph(doc, witnessText(values.acknowledgement), MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, true);
    y += 4;
    y = drawCaption(doc, "NOTARY PUBLIC", y);
    for (const line of registryLines(values.acknowledgement)) {
        y = writeParagraph(doc, line, MARGIN, y, CONTENT_WIDTH, BODY_SIZE, BODY_LEADING, false, 0);
    }

    drawFooters(doc);
    return new Uint8Array(doc.output("arraybuffer"));
}
