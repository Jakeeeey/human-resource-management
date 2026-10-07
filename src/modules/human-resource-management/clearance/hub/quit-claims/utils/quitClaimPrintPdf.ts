import { jsPDF } from "jspdf";
import { __createTable, __drawTable } from "jspdf-autotable";
import type { RowInput, UserOptions } from "jspdf-autotable";

import type {
    QuitClaimAccountability,
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
const BODY_SIZE = 10;
const BODY_LEADING = 15;
const FIELD_SIZE = 10;
const FIELD_LEADING = 15;
const CAPTION_SIZE = 8;
const NET_SIZE = 13;
const GREY = 110;
const ACCOUNTABILITY_MIN_ROWS = 5;
const DEDUCTION_MIN_ROWS = 3;
const DUE_MIN_ROWS = 3;
const FALLBACK_COMPANY = "VERTEX TECHNOLOGIES CORPORATION";

const CLEARANCE_PARAGRAPHS: string[] = [
    "All clearing officers and Accounts covered should indicate on this form all employees’ accountabilities within respective offices.",
    "This form shall route to the clearing officer/offices one after the other. The last clearing officer (coordinator) shall be responsible in furnishing the copies to the employee, employee’s 201 file and disbursing officer concerned.",
    "No terminal payment shall be made by any disbursing officer unless he has received his copy of the duly accomplished clearance certificate, and the employee has shown proof that he has settled all the accountabilities indicated there under.",
    "All clearing officers shall see to it that no further purchases, loans and/or issuances shall be given to the above-named employee after clearing date.",
    "Please do not delay the routine of this form.",
];

const DEDUCTION_AUTHORISATION =
    "I hereby authorize VERTEX TECHNOLOGIES CORPORATION to deduct from my salary and other remuneration any/or all money/accountabilities due to the company as enumerated.";

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
const CC_LEADING = 14;

const REPUBLIC_LINE_1 = "REPUBLIC OF THE PHILIPPINES )";
const REPUBLIC_LINE_2 = "CITY/MUNICIPALITY OF __________________ ) S.S.";

const JURAT =
    "BEFORE ME, a Notary Public for and in ______________________________, personally appeared ______________________________, with valid government-issued ID ______________________________, with ID No. ______________________________, known to me to be the same person who executed the foregoing Release and Quitclaim, and acknowledged to me that the same is his/her free and voluntary act and deed.";

const WITNESS_LINE =
    "IN WITNESS WHEREOF, I have hereunto set my hand and affixed my notarial seal this ___ day of _______, 20, at __________, Philippines.";

const REGISTRY_LINES: string[] = [
    "Doc. No. ____;",
    "Page No. ____;",
    "Book No. ____;",
    "Series of ____.",
];

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
    doc.setFont("helvetica", "normal");
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

function drawTitle(doc: jsPDF, text: string, y: number, size: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(0);
    doc.text(text, PAGE_WIDTH / 2, y, { align: "center" });
    return y + size + 10;
}

function drawCaption(doc: jsPDF, text: string, y: number): number {
    doc.setFont("helvetica", "bold");
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
    doc.text(first, indentX, y);
    let cursor = y + CC_LEADING;
    for (const entry of segments.slice(1)) {
        doc.text(entry, indentX, cursor);
        cursor += CC_LEADING;
    }
    return cursor + 2;
}

function drawField(doc: jsPDF, label: string, value: string, x: number, y: number, width: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    doc.text(label, x, y);
    const valueX = x + doc.getTextWidth(label) + 6;
    doc.setFont("helvetica", "normal");
    let cursor = y;
    if (value !== "") {
        const lines = doc.splitTextToSize(value, Math.max(24, x + width - valueX));
        for (const line of lines) {
            doc.text(line, valueX, cursor);
            cursor += FIELD_LEADING;
        }
        cursor -= FIELD_LEADING;
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(x, cursor + 4, x + width, cursor + 4);
    return cursor + 22;
}

function writeParagraph(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    size: number = BODY_SIZE,
    leading: number = BODY_LEADING
): number {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(text, maxWidth);
    let cursor = y;
    for (const line of lines) {
        if (cursor > BODY_BOTTOM) {
            doc.addPage();
            cursor = MARGIN;
        }
        doc.text(line, x, cursor);
        cursor += leading;
    }
    return cursor;
}

function writeRichParagraph(
    doc: jsPDF,
    runs: UnderlineRun[],
    x: number,
    y: number,
    maxWidth: number,
    size: number = BODY_SIZE,
    leading: number = BODY_LEADING
): number {
    const words: UnderlineRun[] = [];
    for (const run of runs) {
        for (const piece of run.text.split(" ")) {
            if (piece !== "") {
                words.push({ text: piece, underline: run.underline });
            }
        }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(0);
    const spaceWidth = doc.getTextWidth(" ");
    let cursorX = x;
    let cursorY = y;
    let pending: { x: number; width: number }[] = [];
    const flush = (): void => {
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        for (const span of pending) {
            doc.line(span.x, cursorY + 2, span.x + span.width, cursorY + 2);
        }
        pending = [];
    };
    for (const word of words) {
        const wordWidth = doc.getTextWidth(word.text);
        const gap = cursorX > x ? spaceWidth : 0;
        if (cursorX + gap + wordWidth > x + maxWidth) {
            flush();
            cursorY += leading;
            if (cursorY > BODY_BOTTOM) {
                doc.addPage();
                cursorY = MARGIN;
            }
            cursorX = x;
        }
        if (cursorX > x) {
            cursorX += spaceWidth;
        }
        doc.text(word.text, cursorX, cursorY);
        if (word.underline) {
            pending.push({ x: cursorX, width: wordWidth });
        }
        cursorX += wordWidth;
    }
    flush();
    return cursorY + leading;
}

function drawSignatureLine(doc: jsPDF, x: number, y: number, width: number, value: string, caption: string): number {
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(x, y, x + width, y);
    const centerX = x + width / 2;
    let cursor = y + 14;
    if (value !== "") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FIELD_SIZE);
        doc.setTextColor(0);
        doc.text(value, centerX, cursor, { align: "center" });
        cursor += 12;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(CAPTION_SIZE);
    doc.setTextColor(GREY);
    doc.text(caption, centerX, cursor, { align: "center" });
    doc.setTextColor(0);
    return cursor + 18;
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
            font: "helvetica",
            fontSize: 9,
            textColor: [0, 0, 0],
            lineColor: [0, 0, 0],
            lineWidth: 0.5,
            cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
            minCellHeight: 18,
            valign: "middle",
        },
        headStyles: {
            fontStyle: "bold",
            halign: "center",
            fillColor: [255, 255, 255],
            fontSize: 10,
        },
        columnStyles,
    });
    __drawTable(doc, table);
    return (table.finalY ?? startY) + 6;
}

function padAccountabilities(rows: QuitClaimAccountability[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.outlet, row.name, row.date, "", row.remarks]);
    while (out.length < ACCOUNTABILITY_MIN_ROWS) {
        out.push(["", "", "", "", ""]);
    }
    return out;
}

function padDeductions(rows: QuitClaimDeduction[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.label, row.amount, ""]);
    while (out.length < DEDUCTION_MIN_ROWS) {
        out.push(["", "", ""]);
    }
    return out;
}

function padDueToEmployee(rows: QuitClaimDueToEmployee[]): RowInput[] {
    const out: RowInput[] = rows.map((row) => [row.item, row.days, row.amount]);
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
    let cursor = y + 13;
    if (name !== "") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(FIELD_SIZE);
        doc.setTextColor(0);
        if (centered) {
            doc.text(name, x + width / 2, cursor, { align: "center" });
        } else {
            doc.text(name, x, cursor);
        }
    }
    cursor += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    if (centered) {
        doc.text(title, x + width / 2, cursor, { align: "center" });
    } else {
        doc.text(title, x, cursor);
    }
    return cursor + 16;
}

function drawSection2Signatories(doc: jsPDF, values: QuitClaimValues, y: number): number {
    const signatories = values.section2_signatories ?? [];
    const payrollName = section2SignatoryName(signatories, "Payroll Officer");
    const treasuryName = section2SignatoryName(signatories, "Treasury Officer");
    const managerName = section2SignatoryName(signatories, "General Manager");
    const financeName = section2SignatoryName(signatories, "CFO");
    const executiveName = section2SignatoryName(signatories, "CEO");
    const verifiedLabel = "Amount verified by:";
    doc.setFont("helvetica", "normal");
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
    doc.text("Payroll Officer", verifiedX + verifiedWidth / 2, y + 15, { align: "center" });
    let cursor = y + 37;
    cursor = drawSection2Signatory(doc, MARGIN, cursor, 80, treasuryName, "Treasury Officer", false);
    cursor += 19;
    drawSection2Signatory(doc, MARGIN, cursor, 105, managerName, "General Manager", false);
    drawSection2Signatory(doc, 257, cursor, 100, financeName, "Chief Finance Officer", false);
    drawSection2Signatory(doc, 445, cursor, 95, executiveName, "Chief Executive Officer", true);
    return cursor + 54;
}

function drawFooters(doc: jsPDF): void {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
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
    y = drawTitle(doc, "EMPLOYEE CLEARANCE", y, TITLE_SIZE);
    y = drawField(doc, "DATE:", values.identity.date, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "NAME:", values.identity.name, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "POSITION:", values.identity.position, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "SEPARATION:", values.identity.separation, MARGIN, y, CONTENT_WIDTH);
    y += 6;
    for (const paragraph of CLEARANCE_PARAGRAPHS) {
        y = writeParagraph(doc, paragraph, MARGIN, y, CONTENT_WIDTH);
        y += 4;
    }
    y += 2;
    if (y + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const halfWidth = (CONTENT_WIDTH - 36) / 2;
    const managerY = y;
    drawSignatureLine(doc, MARGIN + halfWidth + 36, managerY, halfWidth, values.manager_signature_date, "MANAGER’S SIGNATURE/DATE");
    y = managerY + 52;
    y = writeParagraph(doc, DEDUCTION_AUTHORISATION, MARGIN, y, CONTENT_WIDTH);
    y += 10;
    if (y + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const employeeWidth = 280;
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
    y = drawTitle(doc, "ACCOUNTABILITIES", y, SECTION_SIZE);
    y = drawField(doc, "NAME:", values.identity.name, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "COMPANY:", values.identity.company, MARGIN, y, CONTENT_WIDTH);
    y += 6;
    y = writeParagraph(doc, CERTIFYING_SENTENCE, MARGIN, y, CONTENT_WIDTH);
    y += 6;
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
    y += 10;
    y = drawCaption(doc, "Deductions", y);
    if (y + 72 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawGridTable(doc, y, ["", "AMOUNT", "CERTIFIED BY:"], padDeductions(values.deductions), [260, 110]);
    y += 10;
    y = drawCaption(doc, "DUE TO EMPLOYEE:", y);
    if (y + 72 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const dueRows = padDueToEmployee(values.due_to_employee);
    dueRows.push([
        { content: "TOTAL:", styles: { fontStyle: "bold", halign: "right" } },
        "",
        { content: values.totals.total, styles: { fontStyle: "bold" } },
    ]);
    dueRows.push([
        { content: "LESS: DEDUCTIONS", styles: { fontStyle: "bold", halign: "right" } },
        "",
        { content: values.totals.less_deductions, styles: { fontStyle: "bold" } },
    ]);
    y = drawGridTable(doc, y, ["ITEM", "NO. OF DAYS", "AMOUNT"], dueRows, [undefined, 110, 130]);
    y += 12;
    if (y + 24 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const netLabel = "NET DUE TO EMPLOYEE:";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(NET_SIZE);
    doc.setTextColor(0);
    doc.text(netLabel, MARGIN, y);
    const netX = MARGIN + doc.getTextWidth(netLabel) + 10;
    if (values.totals.net !== "") {
        doc.text(values.totals.net, netX, y);
    } else {
        doc.setDrawColor(0);
        doc.setLineWidth(0.75);
        doc.line(netX, y + 3, PAGE_WIDTH - MARGIN, y + 3);
    }
    y += 20;
    if (y + 160 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawSection2Signatories(doc, values, y);

    doc.addPage();
    y = MARGIN;
    y = drawTitle(doc, "RELEASE AND QUITCLAIM", y, TITLE_SIZE);
    y = writeRichParagraph(
        doc,
        [
            { text: RELEASE_PRE_1, underline: false },
            { text: resolvedCompany, underline: true },
            { text: RELEASE_POST_1, underline: false },
        ],
        MARGIN,
        y,
        CONTENT_WIDTH
    );
    y += 4;
    y = writeParagraph(doc, RELEASE_P2, MARGIN, y, CONTENT_WIDTH);
    y += 10;
    if (y + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawSignatureLine(
        doc,
        PAGE_WIDTH / 2 - employeeWidth / 2,
        y,
        employeeWidth,
        values.identity.name,
        "Signature over Printed Name"
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FIELD_SIZE);
    doc.setTextColor(0);
    const dateSignedText = "Date Signed: ________________________";
    doc.text(dateSignedText, PAGE_WIDTH - MARGIN - doc.getTextWidth(dateSignedText), y);
    y += 18;
    y = drawCaption(doc, "Record of payment:", y);
    y = drawField(doc, "Amount:", values.payment.amount, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "Check /Account #:", values.payment.check_no, MARGIN, y, CONTENT_WIDTH);
    y = drawField(doc, "Date:", values.payment.date, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    y = drawField(doc, "Released/Disbursed By:/Date", values.released_by.name, MARGIN, y, CONTENT_WIDTH);
    y = writeParagraph(doc, "HR Officer", MARGIN, y, CONTENT_WIDTH);
    y += 4;
    y = drawField(doc, "Date Signed:", values.released_by.date, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    y = drawCcBlock(doc, y);
    y += 2;
    if (y + 40 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    y = drawTitle(doc, "ACKNOWLEDGEMENT", y, 12);
    y = writeParagraph(doc, "ACKNOWLEDGMENT", MARGIN, y, CONTENT_WIDTH);
    y = writeParagraph(doc, REPUBLIC_LINE_1, MARGIN, y, CONTENT_WIDTH);
    y = writeParagraph(doc, REPUBLIC_LINE_2, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    y = writeParagraph(doc, JURAT, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    y = writeParagraph(doc, WITNESS_LINE, MARGIN, y, CONTENT_WIDTH);
    y += 4;
    for (const line of REGISTRY_LINES) {
        y = writeParagraph(doc, line, MARGIN, y, CONTENT_WIDTH);
    }
    y += 10;
    if (y + 60 > BODY_BOTTOM) {
        doc.addPage();
        y = MARGIN;
    }
    const notaryWidth = 240;
    y = drawSignatureLine(doc, PAGE_WIDTH / 2 - notaryWidth / 2, y, notaryWidth, "", "NOTARY PUBLIC");

    drawFooters(doc);
    return new Uint8Array(doc.output("arraybuffer"));
}
