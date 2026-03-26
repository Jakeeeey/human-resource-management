import { PdfEngine } from '@/components/pdf-layout-design/PdfEngine';
import type { CompanyData } from '@/components/pdf-layout-design/types';
import autoTable from 'jspdf-autotable';
import type { EmployeeAttendanceRow } from '../hooks/useEmployeeReport';
import type { Employee } from '../hooks/useEmployeeReport';
import { minsToHM } from './index';

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
 * Helper to format date  
 */
function formatDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
 * Export employee attendance history to PDF with professional formatting
 */
export const exportEmployeeHistoryToPDF = async (
  employee: Employee,
  logs: EmployeeAttendanceRow[],
  fromDate: string,
  toDate: string
) => {
  // Calculate totals
  const workLogs = logs.filter(l => l.status !== 'Rest Day' && l.status !== 'Holiday');
  const daysAttended = workLogs.filter(l => l.status !== 'Absent').length;
  const daysAbsent = workLogs.filter(l => l.status === 'Absent').length;
  const totalWorkMins = workLogs.reduce((s, l) => s + Math.min(l.work_hours, 480), 0);
  const totalOvertMin = workLogs.reduce((s, l) => s + l.overtime, 0);
  const totalLateMins = workLogs.reduce((s, l) => s + l.late, 0);

  // Prepare table data
  const tableData = logs.slice(0, 50).map((l) => [
    formatDate(l.log_date),
    formatTime(l.time_in),
    l.status === 'Rest Day' ? 'Rest Day' : l.status === 'Holiday' ? 'Holiday' : (formatTime(l.time_in) ? '✓' : '—'),
    minsToHM(Math.min(l.work_hours, 480)),
    minsToHM(l.overtime),
    minsToHM(l.late),
    l.status === 'On Time' || l.status === 'Late' ? 'Present' : l.status,
  ]);

  const fileName = `${employee.user_fname}_${employee.user_lname}_Attendance_${fromDate}_to_${toDate}.pdf`;

  try {
    const companyData = await fetchCompanyData();

    const doc = await PdfEngine.generateWithFrame(
      'Employee Attendance Report',
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

        // Employee header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${employee.user_fname} ${employee.user_lname}`, margins.left, startY);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(
          `${employee.user_position} | ${employee.department_name}`,
          margins.left,
          startY + 6
        );
        doc.setTextColor(0, 0, 0);

        // Period info
        doc.setFontSize(9);
        doc.text(
          `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`,
          margins.left,
          startY + 12
        );

        // Summary metrics
        const summaryY = startY + 19;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const summaryText = `Days Attended: ${daysAttended} | Days Absent: ${daysAbsent} | Work: ${minsToHM(totalWorkMins)} | OT: ${minsToHM(totalOvertMin)} | Late: ${minsToHM(totalLateMins)}`;
        doc.text(summaryText, margins.left, summaryY);

        // Table
        autoTable(doc, {
          startY: summaryY + 7,
          head: [['Date', 'Time In', 'Present', 'Work Hours', 'Overtime', 'Late', 'Status']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
          },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 20, halign: 'right' },
            4: { cellWidth: 20, halign: 'right' },
            5: { cellWidth: 18, halign: 'right' },
            6: { cellWidth: 25, halign: 'center' },
          },
        });
      }
    );

    // Download
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
