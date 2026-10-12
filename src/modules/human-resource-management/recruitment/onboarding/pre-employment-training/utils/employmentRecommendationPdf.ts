import { jsPDF } from "jspdf";

export interface EmploymentRecommendationSignatory {
    name: string;
    title: string;
}

export interface EmploymentRecommendationAcknowledgement {
    label?: string;
    printedName: string;
    signatureDataUrl?: string | null;
}

export interface EmploymentRecommendationPdfInput {
    employeeName: string;
    employeeAddress: string;
    salutationName: string;
    position: string;
    department?: string;
    companyName: string;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
    letterDate: string;
    effectivityDate: string;
    probationText?: string;
    preparedBy: EmploymentRecommendationSignatory;
    notedBy: EmploymentRecommendationSignatory;
    approvedBy: EmploymentRecommendationSignatory;
    acknowledgement: EmploymentRecommendationAcknowledgement;
}

const PAGE_MARGIN = 56;
const BODY_SIZE = 11;
const BODY_LINE = 18;
const PARAGRAPH_GAP = 12;
const HEADER_GREY = 115;
const FOOTER_SIZE = 8.5;
const FOOTER_RESERVE = 30;
const SIGN_RULE_WIDTH = 200;
const SIGNATURE_IMAGE_HEIGHT = 36;

interface PdfRun {
    text: string;
    bold?: boolean;
}

interface PdfToken {
    text: string;
    bold: boolean;
    width: number;
}

function formatLongDate(input: string | null | undefined): string {
    if (typeof input !== "string" || !input.trim()) return "________________";
    const d = new Date(`${input.trim()}T00:00:00`);
    if (Number.isNaN(d.getTime())) return input;
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const blank = (v: string | null | undefined): string => {
    if (typeof v !== "string") return "________________";
    return v.trim() ? v : "________________";
};

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

function layoutLines(doc: jsPDF, runs: PdfRun[], maxWidth: number): PdfToken[][] {
    const tokens = buildTokens(doc, runs);
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
    return lines;
}

export function buildEmploymentRecommendationPdf(
    input: EmploymentRecommendationPdfInput,
    logoDataUrl: string | null
): Blob {
    const rawDepartment =
        typeof input.department === "string" ? input.department.trim() : "";
    const rawProbation =
        typeof input.probationText === "string" ? input.probationText.trim() : "";
    const acknowledgementLabel =
        typeof input.acknowledgement.label === "string" &&
        input.acknowledgement.label.trim()
            ? input.acknowledgement.label
            : "Acknowledged by:";
    const acknowledgementName =
        typeof input.acknowledgement.printedName === "string" &&
        input.acknowledgement.printedName.trim()
            ? input.acknowledgement.printedName
            : blank(input.employeeName);

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - PAGE_MARGIN * 2;
    const bottomLimit = pageHeight - PAGE_MARGIN - FOOTER_RESERVE;

    let y = PAGE_MARGIN;

    function drawLogo(x: number, top: number, height: number): number {
        if (!logoDataUrl) return 0;
        try {
            const props = doc.getImageProperties(logoDataUrl);
            const width = height * (props.width / props.height);
            doc.addImage(logoDataUrl, "PNG", x, top, width, height);
            return width;
        } catch {
            return 0;
        }
    }

    function drawFullLetterhead(): void {
        const logoHeight = 48;
        const logoWidth = drawLogo(PAGE_MARGIN, y, logoHeight);
        const headerX = logoWidth > 0 ? PAGE_MARGIN + logoWidth + 12 : PAGE_MARGIN;
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0);
        const nameLines = doc.splitTextToSize(
            blank(input.companyName),
            pageWidth - headerX - PAGE_MARGIN
        ) as string[];
        let headerY = y + 14;
        for (const line of nameLines) {
            doc.text(line, headerX, headerY);
            headerY += 14;
        }
        doc.setTextColor(HEADER_GREY);
        doc.setFont("times", "normal");
        doc.setFontSize(9.5);
        for (const line of [
            `Address: ${blank(input.headerAddress)}`,
            `Contact #: ${blank(input.headerContact)}`,
            `Email Address: ${blank(input.headerEmail)}`,
        ]) {
            const wrapped = doc.splitTextToSize(
                line,
                pageWidth - headerX - PAGE_MARGIN
            ) as string[];
            for (const piece of wrapped) {
                doc.text(piece, headerX, headerY);
                headerY += 12;
            }
        }
        y += Math.max(logoHeight, headerY - y) + 12;
        doc.setTextColor(0);
        doc.setDrawColor(0);
        doc.setLineWidth(0.75);
        doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
        doc.line(PAGE_MARGIN, y + 3, pageWidth - PAGE_MARGIN, y + 3);
        y += 24;
    }

    function drawContinuationLetterhead(): void {
        const logoHeight = 26;
        const logoWidth = drawLogo(PAGE_MARGIN, y, logoHeight);
        const headerX = logoWidth > 0 ? PAGE_MARGIN + logoWidth + 10 : PAGE_MARGIN;
        doc.setTextColor(0);
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text(
            blank(input.companyName),
            headerX,
            y + 17,
            { maxWidth: pageWidth - headerX - PAGE_MARGIN }
        );
        y += logoHeight + 10;
        doc.setDrawColor(0);
        doc.setLineWidth(0.75);
        doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
        y += 22;
    }

    function addContinuationPage(): void {
        doc.addPage();
        y = PAGE_MARGIN;
        drawContinuationLetterhead();
    }

    function ensureSpace(needed: number): void {
        if (y + needed > bottomLimit) addContinuationPage();
    }

    function drawLineTokens(line: PdfToken[], x: number, lineY: number): void {
        let cursor = x;
        for (const token of line) {
            doc.setFont("times", token.bold ? "bold" : "normal");
            doc.text(token.text, cursor, lineY);
            cursor += token.width;
        }
    }

    function paragraph(runs: PdfRun[], gapBefore = true): void {
        const lines = layoutLines(doc, runs, contentWidth);
        if (lines.length === 0) return;
        if (gapBefore) y += PARAGRAPH_GAP;
        doc.setFontSize(BODY_SIZE);
        for (const line of lines) {
            ensureSpace(BODY_LINE);
            drawLineTokens(line, PAGE_MARGIN, y);
            y += BODY_LINE;
        }
    }

    function wrapped(bold: boolean, text: string): void {
        const lines = doc.splitTextToSize(blank(text), contentWidth) as string[];
        doc.setFont("times", bold ? "bold" : "normal");
        doc.setFontSize(BODY_SIZE);
        for (const line of lines) {
            ensureSpace(BODY_LINE);
            doc.text(line, PAGE_MARGIN, y);
            y += BODY_LINE;
        }
    }

    function signatoryBlock(label: string, person: EmploymentRecommendationSignatory): void {
        ensureSpace(BODY_LINE * 3 + 8);
        doc.setFont("times", "bold");
        doc.setFontSize(BODY_SIZE);
        doc.text(label, PAGE_MARGIN, y);
        y += BODY_LINE;
        doc.text(blank(person.name).toUpperCase(), PAGE_MARGIN, y);
        y += 14;
        doc.setFont("times", "normal");
        doc.text(blank(person.title), PAGE_MARGIN, y);
        y += BODY_LINE + 8;
    }

    drawFullLetterhead();

    doc.setTextColor(0);
    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    ensureSpace(BODY_LINE);
    doc.text(`Date: ${formatLongDate(input.letterDate)}`, PAGE_MARGIN, y);
    y += 30;

    wrapped(true, input.employeeName);
    wrapped(false, input.employeeAddress);
    y += 6;

    doc.setFont("times", "bold");
    doc.setFontSize(BODY_SIZE);
    ensureSpace(BODY_LINE);
    const subjectLines = doc.splitTextToSize(
        "Subject: Recommendation for Employment",
        contentWidth
    ) as string[];
    for (const line of subjectLines) {
        ensureSpace(BODY_LINE);
        doc.text(line, PAGE_MARGIN, y);
        y += BODY_LINE;
    }
    y += 6;

    paragraph([{ text: `Dear ${blank(input.salutationName)},` }], false);

    if (rawDepartment) {
        paragraph([
            { text: "This is to confirm that " },
            { text: blank(input.employeeName), bold: true },
            { text: " has satisfactorily completed the pre-employment training program conducted for the position of " },
            { text: blank(input.position), bold: true },
            { text: " in the " },
            { text: blank(rawDepartment), bold: true },
            { text: " of " },
            { text: blank(input.companyName), bold: true },
            { text: "." },
        ]);
    } else {
        paragraph([
            { text: "This is to confirm that " },
            { text: blank(input.employeeName), bold: true },
            { text: " has satisfactorily completed the pre-employment training program conducted for the position of " },
            { text: blank(input.position), bold: true },
            { text: " at " },
            { text: blank(input.companyName), bold: true },
            { text: "." },
        ]);
    }

    if (rawDepartment) {
        paragraph([
            { text: "On the basis of the results of the said training program, " },
            { text: blank(input.employeeName), bold: true },
            { text: " is hereby recommended for employment as " },
            { text: blank(input.position), bold: true },
            { text: " in the " },
            { text: blank(rawDepartment), bold: true },
            { text: " of " },
            { text: blank(input.companyName), bold: true },
            { text: "." },
        ]);
    } else {
        paragraph([
            { text: "On the basis of the results of the said training program, " },
            { text: blank(input.employeeName), bold: true },
            { text: " is hereby recommended for employment as " },
            { text: blank(input.position), bold: true },
            { text: " at " },
            { text: blank(input.companyName), bold: true },
            { text: "." },
        ]);
    }

    paragraph([
        { text: "The appointment shall be on a probationary basis, effective " },
        { text: formatLongDate(input.effectivityDate), bold: true },
        { text: "." },
    ]);

    if (rawProbation) {
        paragraph([{ text: rawProbation }]);
    }

    paragraph([
        {
            text: "Should you have any questions or require further clarification, please feel free to contact the Human Resources Department.",
        },
    ]);
    paragraph([
        {
            text: "We welcome you to the company and wish you success in your employment.",
        },
    ]);

    ensureSpace(BODY_LINE * 12 + SIGNATURE_IMAGE_HEIGHT + 120);
    y += 12;
    signatoryBlock("PREPARED BY:", input.preparedBy);
    signatoryBlock("NOTED BY:", input.notedBy);
    signatoryBlock("APPROVED BY:", input.approvedBy);

    ensureSpace(BODY_LINE * 4 + SIGNATURE_IMAGE_HEIGHT + 40);
    doc.setFont("times", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(acknowledgementLabel, PAGE_MARGIN, y);
    y += BODY_LINE + SIGNATURE_IMAGE_HEIGHT + 6;
    const signatureImage = input.acknowledgement.signatureDataUrl ?? null;
    if (signatureImage) {
        try {
            const props = doc.getImageProperties(signatureImage);
            const imageWidth = SIGNATURE_IMAGE_HEIGHT * (props.width / props.height);
            doc.addImage(
                signatureImage,
                "PNG",
                PAGE_MARGIN,
                y - SIGNATURE_IMAGE_HEIGHT - 4,
                imageWidth,
                SIGNATURE_IMAGE_HEIGHT
            );
        } catch {
            doc.setFont("times", "normal");
        }
    }
    doc.setDrawColor(0);
    doc.setLineWidth(0.75);
    doc.line(PAGE_MARGIN, y, PAGE_MARGIN + SIGN_RULE_WIDTH, y);
    y += BODY_LINE;
    doc.setFont("times", "normal");
    doc.setFontSize(BODY_SIZE);
    doc.text(blank(acknowledgementName), PAGE_MARGIN, y);
    y += BODY_LINE;

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
        doc.setPage(i);
        doc.setFont("times", "normal");
        doc.setFontSize(FOOTER_SIZE);
        doc.setTextColor(HEADER_GREY);
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 24,
            { align: "center" }
        );
    }
    doc.setTextColor(0);

    return doc.output("blob");
}
