import { LogisticsTopSheetItem } from "../types/logistics-top-sheet.schema";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import autoTable from "jspdf-autotable";

export const generateLogisticsTopSheetPdf = async (
    data: LogisticsTopSheetItem[],
    cutoffStart: string,
    cutoffEnd: string
) => {
    // Determine the template name (assuming "Official Header" exists)
    const templateName = "Official Header";

    // Format dates for display
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    const periodStr = `${formatDate(cutoffStart)} — ${formatDate(cutoffEnd)}`;

    // Format Currency
    const formatCurrency = (val: number) => {
        if (val === 0) return "PHP 0.00";
        return `PHP ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const doc = await PdfEngine.generateWithFrame(templateName, {}, (doc, startY) => {
        // Draw the Sub-Headers based on the screenshot
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        
        let currentY = startY + 5;
        doc.text("DEPARTMENT: ALL DEPARTMENTS", 14, currentY);
        doc.text(`EMPLOYEES: ${data.length}`, 196, currentY, { align: "right" });
        
        currentY += 6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`PERIOD: ${periodStr}`, 14, currentY);
        
        currentY += 6;
        doc.text(`PAYROLL ID: PR-LOGISTICS-${cutoffStart.replace(/-/g, "")}-${cutoffEnd.replace(/-/g, "")}`, 14, currentY);
        doc.text("POSTED ON: —", 196, currentY, { align: "right" });

        // Draw horizontal line separator
        currentY += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(14, currentY, 196, currentY);

        currentY += 5;

        // Draw the AutoTable
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableBody: any[] = [];
        data.forEach(item => {
            // Main Employee Row
            tableBody.push([
                { content: item.employeeName, styles: { fontStyle: 'bold' } },
                item.employeeId,
                item.type,
                formatCurrency(item.grossPay),
                formatCurrency(item.additions),
                formatCurrency(item.deductions),
                { content: formatCurrency(item.netPay), styles: { fontStyle: 'bold', textColor: [0, 50, 100] } }
            ]);

            // Detailed Additions Sub-rows as a single numbered list cell
            if (item.additionsList && item.additionsList.length > 0) {
                const lines = item.additionsList.map((add, idx) => {
                    return `${idx + 1}. ${add.description} (${formatCurrency(add.amount)})`;
                });
                
                tableBody.push([
                    { content: lines.join('\n'), colSpan: 7, styles: { fontStyle: 'normal', textColor: [60, 60, 60], halign: 'left', cellPadding: { top: 2, right: 2, bottom: 2, left: 10 } } }
                ]);
            }
        });

        autoTable(doc, {
            startY: currentY,
            head: [['EMPLOYEE NAME', 'ID', 'TYPE', 'GROSS PAY', 'ADDITIONS', 'DEDUCTIONS', 'NET PAY']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 245, 250],
                textColor: [0, 50, 100],
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: [40, 40, 40]
            },
            columnStyles: {
                0: { halign: 'left' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
                6: { halign: 'right', fontStyle: 'bold', textColor: [0, 50, 100] } // Net Pay bold and colored
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            },
            margin: { left: 14, right: 14 }
        });
    });

    doc.save(`Logistics-Top-Sheet-${cutoffStart}-to-${cutoffEnd}.pdf`);
};
