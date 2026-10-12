import { jsPDF } from "jspdf";

export interface PreEmploymentTrainingSignatory {
    name: string;
    title: string;
}

export interface PreEmploymentTrainingTraineeBlock {
    label?: string;
    printedName: string;
    signatureDataUrl?: string | null;
}

export interface PreEmploymentTrainingPdfInput {
    applicantName: string;
    applicantAddress: string;
    salutationName: string;
    position: string;
    companyName: string;
    letterDate: string;
    headerAddress: string;
    headerContact: string;
    headerEmail: string;
    scheduleText?: string;
    durationText?: string;
    startDate: string;
    endDate: string;
    reportingTo: string;
    allowanceText: string;
    preparedBy: PreEmploymentTrainingSignatory;
    notedBy: PreEmploymentTrainingSignatory;
    approvedBy: PreEmploymentTrainingSignatory;
    trainee: PreEmploymentTrainingTraineeBlock;
}

const PAGE_MARGIN = 56;
const BODY_SIZE = 11;
const BODY_LINE = 18;
const PARAGRAPH_GAP = 12;
const HEADING_SIZE = 12;
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

export function buildPreEmploymentTrainingPdf(
    input: PreEmploymentTrainingPdfInput,
    logoDataUrl: string | null
): Blob {
    const rawDuration =
        typeof input.durationText === "string" ? input.durationText.trim() : "";
    const durationText = rawDuration ? rawDuration : "Two (2) weeks";
    const rawSchedule =
        typeof input.scheduleText === "string" ? input.scheduleText.trim() : "";
    const scheduleText = rawSchedule
        ? rawSchedule
        : "Monday to Saturday | 8:30 AM to 5:30 PM";
    const traineeLabel =
        typeof input.trainee.label === "string" && input.trainee.label.trim()
            ? input.trainee.label
            : "Conforme:";

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

    function heading(text: string): void {
        y += PARAGRAPH_GAP + 6;
        ensureSpace(BODY_LINE * 2);
        doc.setFont("times", "bold");
        doc.setFontSize(HEADING_SIZE);
        doc.text(text, pageWidth / 2, y, { align: "center" });
        y += BODY_LINE;
        doc.setFontSize(BODY_SIZE);
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

    function labelRow(label: string, value: string): void {
        doc.setFont("times", "bold");
        doc.setFontSize(BODY_SIZE);
        const labelWithGap = `${label} `;
        const labelWidth = doc.getTextWidth(labelWithGap);
        const valueLines = doc.splitTextToSize(
            blank(value),
            contentWidth - labelWidth
        ) as string[];
        for (let i = 0; i < valueLines.length; i += 1) {
            ensureSpace(BODY_LINE);
            if (i === 0) {
                doc.setFont("times", "bold");
                doc.text(labelWithGap, PAGE_MARGIN, y);
            }
            doc.setFont("times", "normal");
            doc.text(valueLines[i], PAGE_MARGIN + (i === 0 ? labelWidth : 0), y);
            y += BODY_LINE;
        }
    }

    function numberedItem(number: string, runs: PdfRun[]): void {
        doc.setFont("times", "normal");
        doc.setFontSize(BODY_SIZE);
        const prefix = `${number} `;
        const prefixWidth = doc.getTextWidth(prefix);
        const lines = layoutLines(doc, runs, contentWidth - prefixWidth);
        if (lines.length === 0) return;
        y += 4;
        for (let i = 0; i < lines.length; i += 1) {
            ensureSpace(BODY_LINE);
            if (i === 0) {
                doc.setFont("times", "normal");
                doc.text(prefix, PAGE_MARGIN, y);
            }
            drawLineTokens(lines[i], PAGE_MARGIN + (i === 0 ? prefixWidth : prefixWidth), y);
            y += BODY_LINE;
        }
    }

    function bullet(text: string): void {
        doc.setFont("times", "normal");
        doc.setFontSize(BODY_SIZE);
        const prefix = "- ";
        const prefixWidth = doc.getTextWidth(prefix);
        const lines = doc.splitTextToSize(blank(text), contentWidth - prefixWidth) as string[];
        y += 4;
        for (let i = 0; i < lines.length; i += 1) {
            ensureSpace(BODY_LINE);
            if (i === 0) doc.text(prefix, PAGE_MARGIN, y);
            doc.text(lines[i], PAGE_MARGIN + prefixWidth, y);
            y += BODY_LINE;
        }
    }

    function signatoryBlock(label: string, person: PreEmploymentTrainingSignatory): void {
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

    wrapped(true, input.applicantName);
    wrapped(false, input.applicantAddress);
    y += 6;

    doc.setFont("times", "bold");
    doc.setFontSize(BODY_SIZE);
    ensureSpace(BODY_LINE);
    const subjectLines = doc.splitTextToSize(
        "Subject: Two-Week Pre-Employment Training Program",
        contentWidth
    ) as string[];
    for (const line of subjectLines) {
        ensureSpace(BODY_LINE);
        doc.text(line, PAGE_MARGIN, y);
        y += BODY_LINE;
    }
    y += 6;

    paragraph([{ text: `Dear ${blank(input.salutationName)},` }], false);
    paragraph([
        { text: "You have been scheduled to undergo a " },
        { text: "TWO-WEEK PRE-EMPLOYMENT TRAINING PROGRAM", bold: true },
        { text: " as part of the standard qualification and evaluation process for the position of " },
        { text: blank(input.position), bold: true },
        { text: " at " },
        { text: blank(input.companyName), bold: true },
        { text: "." },
    ]);
    paragraph([
        {
            text: "This training program aims to assess your competency, work ethic, and ability to adapt to the operational standards and culture of the company. It also provides you with the necessary orientation and foundational knowledge required for the proper execution of your duties should you proceed to official employment.",
        },
    ]);

    heading("TRAINING DETAILS");
    labelRow("Duration:", durationText);
    labelRow("Schedule:", scheduleText);
    paragraph(
        [
            { text: "Duration: Start: ", bold: true },
            { text: `${formatLongDate(input.startDate)}   ` },
            { text: "End: ", bold: true },
            { text: formatLongDate(input.endDate) },
        ],
        false
    );
    labelRow("Reporting To:", input.reportingTo);
    labelRow("Training Allowance:", input.allowanceText);

    paragraph([
        {
            text: "Please be advised that this training period is NOT CONSIDERED YET AS EMPLOYMENT and does not guarantee immediate hiring. Your performance, conduct, attendance, and adherence to company guidelines during the training period will be used as the basis for determining your eligibility for possible appointment as a Probationary Employee.",
        },
    ]);
    paragraph([
        {
            text: "The training allowance shall be released only upon successful completion of the full two (2) weeks of pre-employment training. Failure to complete the entire training period, for any reason, shall result in forfeiture of the training allowance, and no allowance will be granted.",
        },
    ]);

    heading("NON-DISCLOSURE AND CONFIDENTIALITY CLAUSE");
    paragraph([
        {
            text: "By participating in this pre-employment training program, you acknowledge and agree that any and all information you may encounter - whether written, verbal, visual, or digital - including but not limited to company strategies, client information, pricing structures, system processes, software, internal documents, proprietary materials, and any operational data - are considered STRICTLY CONFIDENTIAL.",
        },
    ]);
    paragraph([{ text: "You hereby agree that:" }]);
    numberedItem("1.", [
        {
            text: "You shall NOT DISCLOSE, share, copy, reproduce, or transmit any confidential information to any person, entity, competitor, or external party without the written permission of the company.",
        },
    ]);
    numberedItem("2.", [
        {
            text: "You shall NOT USE any confidential information for personal gain or for any purpose outside the scope of the pre-employment training.",
        },
    ]);
    numberedItem("3.", [
        {
            text: "This obligation REMAINS IN EFFECT EVEN AFTER the completion of the training period, regardless of whether you are hired or not.",
        },
    ]);
    numberedItem("4.", [
        {
            text: "Any breach of confidentiality may result in immediate disqualification from employment consideration and may subject you to legal action as permitted by law.",
        },
    ]);

    heading("REQUIREMENTS FOR THE FIRST DAY OF TRAINING");
    bullet("Personal laptop");
    bullet("Any additional documents previously requested by the HR Department");

    paragraph([
        {
            text: "Should you have any concerns or require further clarification, please feel free to contact the Human Resources Department.",
        },
    ]);
    paragraph([
        {
            text: "We look forward to your attendance and wish you success during this training period.",
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
    doc.text(traineeLabel, PAGE_MARGIN, y);
    y += BODY_LINE + SIGNATURE_IMAGE_HEIGHT + 6;
    const signatureImage = input.trainee.signatureDataUrl ?? null;
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
    doc.text(blank(input.trainee.printedName), PAGE_MARGIN, y);
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
