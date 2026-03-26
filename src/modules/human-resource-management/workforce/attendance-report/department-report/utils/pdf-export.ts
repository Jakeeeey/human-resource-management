import { PdfEngine } from '@/components/pdf-layout-design/PdfEngine';
import type { CompanyData } from '@/components/pdf-layout-design/types';
import autoTable from 'jspdf-autotable';
import type { DeptAttendanceRow } from '../hooks/useDepartmentReport';
import { minsToHM } from '.';

function formatDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchCompanyData(): Promise<CompanyData | null> {
  try {
    const res = await fetch('/api/pdf/company', { credentials: 'include' });
    if (!res.ok) return null;
    const result = await res.json();
    const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
    return company ?? null;
  } catch (error) {
    console.error('Error fetching company data:', error);
    return null;
  }
}

export const exportDepartmentReportToPDF = async (
  departmentName: string,
  rows: DeptAttendanceRow[],
  fromDate: string,
  toDate: string,
) => {
  const presentStatus = rows.filter(r => ['On Time', 'Late'].includes(r.status));
  const absent        = rows.filter(r => r.status === 'Absent');
  const onTime        = rows.filter(r => r.status === 'On Time');

  const employeeMap = new Map<number, DeptAttendanceRow[]>();
  rows.forEach(row => {
    const id = row.user_id;
    if (!employeeMap.has(id)) employeeMap.set(id, []);
    employeeMap.get(id)!.push(row);
  });

  const tableData = Array.from(employeeMap.entries())
    .slice(0, 50)
    .map(([_userId, logs]) => {
      const firstRow    = logs[0];
      const presentDays = logs.filter(l => ['On Time', 'Late'].includes(l.status)).length;
      const totalOvertime = logs.reduce((s, l) => s + l.overtime, 0);
      const totalLate     = logs.reduce((s, l) => s + l.late,     0);
      return [
        `${firstRow.user_fname} ${firstRow.user_lname}`,
        firstRow.user_position,
        String(presentDays),
        String(logs.filter(l => l.status === 'Absent').length),
        minsToHM(totalOvertime),
        minsToHM(totalLate),
      ];
    });

  const fileName = `${departmentName}_Attendance_Report_${fromDate}_to_${toDate}.pdf`;

  try {
    const companyData = await fetchCompanyData();

    const doc = await PdfEngine.generateWithFrame(
      'Department Attendance Report',
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${departmentName}`, margins.left, startY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Department Attendance Summary`, margins.left, startY + 6);
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(9);
        doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, margins.left, startY + 12);

        const summaryY = startY + 19;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `Present: ${presentStatus.length} | On Time: ${onTime.length} | Absent: ${absent.length}`,
          margins.left, summaryY
        );

        autoTable(doc, {
          startY: summaryY + 7,
          head: [['Employee', 'Position', 'Present Days', 'Absent Days', 'Total OT', 'Total Late']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 35, halign: 'left' },
            1: { cellWidth: 30, halign: 'left' },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 22, halign: 'center' },
            4: { cellWidth: 25, halign: 'right' },
            5: { cellWidth: 25, halign: 'right' },
          },
          didDrawPage: (data: { pageNumber: number }) => {
            const pageSize   = doc.internal.pageSize;
            const pageHeight = pageSize.getHeight();
            const pageWidth  = pageSize.getWidth();
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${data.pageNumber}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
            doc.setTextColor(0);
          },
        });
      }
    );

    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href  = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};