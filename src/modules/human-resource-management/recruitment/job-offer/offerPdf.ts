import { jsPDF } from "jspdf";
import type { JobOfferFormData } from "./types";

// offerPdf.ts — vector Job Offer Letter PDF.
//
// Why this exists: the upload path screenshotted the on-screen letter with
// html2canvas, which produced soft, clipped output at arbitrary proportions.
// This module lays the SAME letter out as real text on one A4 page, so the
// filed PDF is crisp and deterministic. `JobOfferModule.tsx` print surface
// stays the visual source of truth — keep the copy in sync.

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

function formatAmount(input: string): string {
    const n = Number(input.replace(/[^0-9.]/g, ""));
    if (!input.trim() || Number.isNaN(n)) return "________________";
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

/**
 * Greedy-wraps and draws runs of mixed-weight text, one line at a time,
 * advancing the caller's Y cursor. Left-aligned; single-page letters only.
 */
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

/**
 * Builds the Job Offer Letter as a one-page A4 vector PDF.
 * @param {JobOfferFormData} form - Offer terms bound to the letter.
 * @param {string | null} logoDataUrl - Selected company logo, or null to omit it.
 * @returns {Blob} PDF bytes ready for upload.
 */
export function buildOfferPdf(form: JobOfferFormData, logoDataUrl: string | null): Blob {
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
        `Address: ${blank(form.headerAddress)}`,
        `Contact #: ${blank(form.headerContact)}`,
        `Email Address: ${blank(form.headerEmail)}`,
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
    doc.text("Job Offer Letter", pageWidth / 2, y, { align: "center" });
    y += 36;

    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text(formatLongDate(form.offerDate), PAGE_MARGIN, y);
    y += 24;

    doc.setFont("times", "bold");
    doc.text(blank(form.candidateName).toUpperCase(), PAGE_MARGIN, y);
    y += 14;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(blank(form.addressLine), PAGE_MARGIN, y);
    y += 13;
    doc.text(blank(form.contactNumber), PAGE_MARGIN, y);
    y += 24;

    doc.setFontSize(BODY_SIZE);
    y = drawParagraph(
        doc,
        [{ text: "Dear " }, { text: blank(form.salutationName), bold: true }, { text: "," }],
        PAGE_MARGIN,
        y,
        contentWidth,
        BODY_LINE
    );

    const paragraphs: PdfRun[][] = [
        [
            { text: blank(form.companyName), bold: true },
            { text: " is pleased to offer you the position of " },
            { text: blank(form.position), bold: true },
            { text: " based in " },
            { text: blank(form.baseLocation), bold: true },
            { text: ". Your skills and experience will be an ideal fit for the " },
            { text: departmentDisplay(form.department), bold: true },
            ...(form.division.trim() ? [{ text: " under " }, { text: form.division, bold: true }] : []),
            { text: "." },
        ],
        [
            { text: "The " },
            { text: "starting salary", bold: true },
            { text: " for this position is " },
            {
                text: `Php ${formatAmount(form.monthlySalary)}/month (${blank(form.dailyRate)}/day)`,
                bold: true,
            },
            { text: ", which shall be paid every " },
            { text: `${blank(form.payDays)} day of the month`, bold: true },
            { text: "." },
        ],
        [
            { text: "You will undergo an evaluation on your " },
            { text: `${blank(form.evalMonths)} month`, bold: true },
            { text: " during your " },
            { text: `probationary period of ${blank(form.probationText)}`, bold: true },
            { text: "." },
        ],
        [
            {
                text: "If you choose to accept this job offer, please sign this letter, and return it to this office, at your earliest convenience. Please let us know if you have any clarifications so we can provide you with additional information.",
            },
        ],
        [
            { text: "We look forward to welcoming you to the " },
            { text: `${blank(form.companyName)}!`, bold: true },
        ],
    ];

    for (const runs of paragraphs) {
        y += PARAGRAPH_GAP;
        y = drawParagraph(doc, runs, PAGE_MARGIN, y, contentWidth, BODY_LINE);
    }

    y += 18;
    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text("Sincerely yours,", PAGE_MARGIN, y);
    y += 60;

    doc.setFont("times", "bold");
    doc.text(blank(form.signatoryName).toUpperCase(), PAGE_MARGIN, y);
    y += 14;
    doc.setFont("times", "normal");
    doc.text(blank(form.signatoryTitle), PAGE_MARGIN, y);

    return doc.output("blob");
}
