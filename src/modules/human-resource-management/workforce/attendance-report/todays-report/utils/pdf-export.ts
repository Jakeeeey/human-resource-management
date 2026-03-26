import { PdfEngine } from '@/components/pdf-layout-design/PdfEngine';
import type { CompanyData } from '@/components/pdf-layout-design/types';
import autoTable from 'jspdf-autotable';
import type { AttendanceRecord } from '../hooks/useAttendance';

/**
 * Helper to format time for display
 */
function formatTime(t: string | null): string {
  if (!t) return '—';
  const [hStr, mStr] = t.slice(0, 5).split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${mStr}${period}`;
}

/**
 * Fetch company data from API
 */
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

/**
 * Export today's attendance report to PDF with professional formatting
 */
export const exportTodaysAttendanceToPDF = async (
  records: AttendanceRecord[],
  todayDate?: string
) => {
  const today = todayDate || new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Fetch company data for header
  const companyData = await fetchCompanyData();

  // Prepare table data
  const tableData = records.slice(0, 100).map((r) => [
    `${r.user_fname} ${r.user_lname}`,
    r.user_department,
    r.user_position,
    formatTime(r.time_in),
    formatTime(r.time_out),
    r.punctuality ?? '—',
    r.presentStatus,
  ]);

  const fileName = `Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`;

  try {
    const doc = await PdfEngine.generateWithFrame(
      'Attendance Report', // Template name — uses company header
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        
        // Title with proper spacing
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TODAY\'S ATTENDANCE REPORT', margins.left, startY, { baseline: 'top' });

        // Subtitle with date
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${today}`, margins.left, startY + 7, { baseline: 'top' });
        doc.setTextColor(0, 0, 0);

        // Summary line (if records exist)
        if (records.length > 0) {
          const presentCount = records.filter(r => r.presentStatus === 'Present').length;
          const absentCount = records.filter(r => r.presentStatus === 'Absent').length;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Total: ${records.length} | Present: ${presentCount} | Absent: ${absentCount}`,
            margins.left,
            startY + 13,
            { baseline: 'top' }
          );
        }

        // Render table with professional styling
        autoTable(doc, {
          startY: startY + 20,
          head: [['Employee Name', 'Department', 'Position', 'Time In', 'Time Out', 'Punctuality', 'Status']],
          body: tableData,
          margin: { ...margins, bottom: 15 },
          theme: 'striped',
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            lineColor: [30, 100, 150],
            lineWidth: 0.5,
          },
          bodyStyles: {
            fontSize: 8,
            valign: 'middle',
            lineColor: [200, 200, 200],
            lineWidth: 0.2,
          },
          alternateRowStyles: {
            fillColor: [245, 245, 245],
          },
          columnStyles: {
            0: { cellWidth: 35, halign: 'left' },
            1: { cellWidth: 28, halign: 'left' },
            2: { cellWidth: 25, halign: 'left' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 18, halign: 'center' },
            5: { cellWidth: 20, halign: 'center' },
            6: { cellWidth: 18, halign: 'center' },
          },
          didDrawPage: function (data) {
            // Optional: add page numbers
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.height;
            const pageWidth = pageSize.width;
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
              `Page ${data.pageNumber}`,
              pageWidth - 15,
              pageHeight - 10,
              { align: 'right' }
            );
          },
        });
      }
    );

    // Download the PDF
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
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
