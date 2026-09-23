import { jsPDF } from "jspdf";

export interface RecommendationLetterInput {
    employeeName: string;
    position: string;
    department: string;
    letterDate: string;
    companyName: string;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
    signatoryName: string;
    signatoryTitle: string;
}

const PAGE_MARGIN = 56;
const BODY_SIZE = 11;
const BODY_LINE = 18;
const PARAGRAPH_GAP = 12;
const HEADER_GREY = 115;

interface PdfRun {
    text: string;
    bold?: boolean;
}

interface PdfToken {
    text: string;
    bold: boolean;
    width: number;
}

function formatLongDate(input: string): string {
    if (!input) return "________________";
    const d = new Date(`${input}T00:00:00`);
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const blank = (v: string) => (v.trim() ? v : "________________");

function departmentDisplay(value: string): string {
    const name = value.trim();
    if (!name) return "________________";
    return /department$/i.test(name) ? name : `${name} Department`;
}

function buildTokens(doc: jsPDF, runs: PdfRun[]): PdfToken[] {
    const tokens: PdfToken[] = [];
    for (const run of runs) {
        doc.setFont("times", run.bold ? "bold" : "normal");
        for (const part of run.text.split(/(\s+)/)) {
            if (!part) continue;
            tokens.push({ text: part, bold: Boolean(run.bold), width: doc.getTextWidth(part) });
        }
    }
    return tokens;
}

function drawParagraph(
    doc: jsPDF,
    runs: PdfRun[],
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
): number {
    const tokens = buildTokens(doc, runs);
    if (tokens.length === 0) return startY;

    const lines: PdfToken[][] = [];
    let line: PdfToken[] = [];
    let lineWidth = 0;

    for (const token of tokens) {
        const isSpace = /^\s+$/.test(token.text);
        if (isSpace && line.length === 0) continue;
        if (line.length > 0 && lineWidth + token.width > maxWidth) {
            lines.push(line);
            line = [];
            lineWidth = 0;
            if (isSpace) continue;
        }
        line.push(token);
        lineWidth += token.width;
    }
    if (line.length > 0) lines.push(line);

    let y = startY;
    for (const entry of lines) {
        let cursor = x;
        for (const token of entry) {
            doc.setFont("times", token.bold ? "bold" : "normal");
            doc.text(token.text, cursor, y);
            cursor += token.width;
        }
        y += lineHeight;
    }
    return y;
}

export function buildRecommendationLetterPdf(
    input: RecommendationLetterInput,
    logoDataUrl: string | null
): Blob {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - PAGE_MARGIN * 2;

    let y = PAGE_MARGIN;

    const logoHeight = 48;
    let logoWidth = 0;
    if (logoDataUrl) {
        try {
            const props = doc.getImageProperties(logoDataUrl);
            logoWidth = logoHeight * (props.width / props.height);
            doc.addImage(logoDataUrl, "PNG", PAGE_MARGIN, y, logoWidth, logoHeight);
        } catch {
            logoWidth = 0;
        }
    }

    const headerX = logoWidth > 0 ? PAGE_MARGIN + logoWidth + 12 : PAGE_MARGIN;
    doc.setTextColor(HEADER_GREY);
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    let headerY = y + 14;
    for (const line of [
        `Address: ${blank(input.headerAddress)}`,
        `Contact #: ${blank(input.headerContact)}`,
        `Email Address: ${blank(input.headerEmail)}`,
    ]) {
        doc.text(line, headerX, headerY);
        headerY += 12;
    }
    y += Math.max(logoHeight, 36) + 12;

    doc.setTextColor(0);
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    doc.line(PAGE_MARGIN, y + 3, pageWidth - PAGE_MARGIN, y + 3);
    y += 24;

    doc.setFont("times", "bold");
    doc.setFontSize(16.5);
    doc.text("Recommendation for Regularization", pageWidth / 2, y, { align: "center" });
    y += 36;

    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text(formatLongDate(input.letterDate), PAGE_MARGIN, y);
    y += 30;

    doc.setFont("times", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text("TO THE MANAGEMENT:", PAGE_MARGIN, y);
    y += 24;

    doc.setFontSize(BODY_SIZE);
    y = drawParagraph(
        doc,
        [
            { text: "This is to respectfully recommend " },
            { text: blank(input.employeeName).toUpperCase(), bold: true },
            { text: ", " },
            { text: blank(input.position), bold: true },
            { text: " under the " },
            { text: departmentDisplay(input.department), bold: true },
            { text: ", for regularization of employment." },
        ],
        PAGE_MARGIN,
        y,
        contentWidth,
        BODY_LINE
    );

    const paragraphs: PdfRun[][] = [
        [
            { text: blank(input.employeeName), bold: true },
            { text: " has undergone the scheduled performance evaluations during the probationary period and has satisfactorily completed all the requirements thereof. The employee's performance, conduct, and attendance have been found to meet the standards of " },
            { text: blank(input.companyName), bold: true },
            { text: "." },
        ],
        [
            { text: "In view of the above, the undersigned respectfully recommends that " },
            { text: blank(input.employeeName), bold: true },
            { text: " be regularized as " },
            { text: blank(input.position), bold: true },
            { text: " effective upon approval of this recommendation." },
        ],
        [
            {
                text: "We trust that the employee will continue to uphold the values of the company and contribute to the attainment of its goals. Your favorable consideration of this recommendation is highly appreciated.",
            },
        ],
    ];

    for (const runs of paragraphs) {
        y += PARAGRAPH_GAP;
        y = drawParagraph(doc, runs, PAGE_MARGIN, y, contentWidth, BODY_LINE);
    }

    y += 18;
    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text("Respectfully yours,", PAGE_MARGIN, y);
    y += 60;

    doc.setFont("times", "bold");
    doc.text(blank(input.signatoryName).toUpperCase(), PAGE_MARGIN, y);
    y += 14;
    doc.setFont("times", "normal");
    doc.text(blank(input.signatoryTitle), PAGE_MARGIN, y);

    return doc.output("blob");
}
