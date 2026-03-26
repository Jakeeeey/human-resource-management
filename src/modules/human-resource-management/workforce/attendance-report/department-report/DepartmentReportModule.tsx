"use client";

// department-report/DepartmentReportModule.tsx
import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { useDepartmentReport } from './hooks/useDepartmentReport';
import { PdfEngine } from '@/components/pdf-layout-design/PdfEngine';
import { pdfTemplateService } from '@/components/pdf-layout-design/services/pdf-template';
import autoTable from 'jspdf-autotable';
import { minsToHM } from './utils';
import { SummaryCards }    from './components/SummaryCards';
import { AttendanceTable } from './components/AttendanceTable';

/** Returns YYYY-MM-DD for yesterday using local time (avoids UTC+8 offset issues) */
function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 mt-1" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Fetch company data from API
 */
async function fetchCompanyData() {
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
 * Format date helper
 */
function formatDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Handle PDF export with PdfEngine directly
 */
async function handleExportDeptPDF(deptName: string, rows: any[], from: string, to: string) {

  // Group rows by date (to match UI)
  const groupByDate = (rows: any[]) => {
    const map = new Map<string, any[]>();
    rows.forEach(row => {
      const date = row.log_date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(row);
    });
    return map;
  };

  const grouped = groupByDate(rows);

  // Prepare table data: one row per employee per day, grouped by date
  const tableData: any[] = [];
  Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dateRows]) => {
    dateRows.forEach(row => {
      tableData.push([
        `${row.user_fname} ${row.user_lname}`,
        row.user_position || '—',
        minsToHM(row.work_hours),
        minsToHM(row.overtime),
        minsToHM(row.late),
        row.punctuality || '—',
        ['On Time', 'Late'].includes(row.status) ? 'Present' : row.status,
        date
      ]);
    });
  });

  // Calculate department totals (summary)
  const presentStatus = rows.filter(r => ['On Time', 'Late'].includes(r.status));
  const absent = rows.filter(r => r.status === 'Absent');
  const totalOvertMin = rows.reduce((s, r) => s + r.overtime, 0);
  const totalLateMins = rows.reduce((s, r) => s + r.late, 0);

  const fileName = `${deptName}_Report_${from}_to_${to}.pdf`;

  try {
    // Fetch both company data and templates
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);

    // Use first available template (preferring "Header" if it exists)
    const templateName = templates.find(t => t.name === 'Header')?.name || 
                        templates.find(t => t.name.includes('Letter'))?.name ||
                        templates[0]?.name || 
                        'Department Attendance Report';

    const doc = await PdfEngine.generateWithFrame(
      templateName,
      companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${deptName}`, margins.left, startY, { baseline: 'top' });

        // Add space below header line
        const headerLineY = startY + 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Department Attendance Report`, margins.left, headerLineY);
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(9);
        doc.text(
          `Period: ${formatDate(from)} to ${formatDate(to)}`,
          margins.left,
          headerLineY + 6
        );

        const summaryY = headerLineY + 12;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const summaryText = `Total Present Days: ${presentStatus.length} | Total Absent Days: ${absent.length} | Total OT: ${minsToHM(totalOvertMin)} | Total Late: ${minsToHM(totalLateMins)}`;
        doc.text(summaryText, margins.left, summaryY);

        autoTable(doc, {
          startY: summaryY + 4,
          head: [['Name', 'Position', 'Work Hours', 'Overtime', 'Late', 'Punctuality', 'Status', 'Date']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          tableWidth: 'auto',
          headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
          },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          // No fixed columnStyles: let autoTable expand to fill width
          didDrawPage: (data: any) => {
            const pageSize = doc.internal.pageSize;
            const pageHeight = pageSize.getHeight();
            const pageWidth = pageSize.getWidth();

            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
              `Page ${doc.internal.pages.length - 1}`,
              pageWidth / 2,
              pageHeight - 5,
              { align: 'center' }
            );
            doc.setTextColor(0);
          },
        });
      }
    );

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
  }
}

export default function DepartmentReportModule() {
  const yesterday = getYesterdayStr();

  // deptId starts as null; once departments load we default to the first one
  const [deptId, setDeptId] = useState<number | null>(null);
  const [from,   setFrom]   = useState(yesterday);
  const [to,     setTo]     = useState(yesterday);
  const [search, setSearch] = useState('');

  const { loading, error, rows, departments, refetch } = useDepartmentReport(deptId, from, to);

  // Once departments are loaded, default to the first department (e.g. Administrator)
  useEffect(() => {
    if (departments.length > 0 && deptId === null) {
      setDeptId(departments[0].department_id);
    }
  }, [departments, deptId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      `${r.user_fname} ${r.user_lname}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (loading) return <PageSkeleton />;

  if (error) return (
    <div className="p-8 text-center m-8 border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {error}</p>
      <Button variant="outline" className="mt-4" onClick={refetch}>Retry</Button>
    </div>
  );

  return (
    <div className="p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">

      {/* ── Page Title ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Department Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Attendance summary grouped by department and date</p>
      </div>

      {/* ── Inline Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Department dropdown — no "All Departments" option */}
        <Select
          value={deptId ? String(deptId) : ''}
          onValueChange={(v) => setDeptId(Number(v))}
        >
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <SelectValue placeholder="Select department…" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {departments.map((d) => (
              <SelectItem
                key={`dept-${d.department_id}`}
                value={String(d.department_id)}
                className="text-sm"
              >
                {d.department_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* From date */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3 min-w-0">
          <span className="text-sm text-muted-foreground font-medium shrink-0">From</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>

        {/* To date */}
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3 min-w-0">
          <span className="text-sm text-muted-foreground font-medium shrink-0">To</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>

        {/* Search by name */}
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-[200px] text-sm"
        />

        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch('')}
            className="h-9 px-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ✕ Clear
          </Button>
        )}

        {/* Push PDF Export to far right */}
        <div className="flex-1" />
        {/* PDF Export button */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 text-sm gap-2"
          onClick={() => {
            const dept = departments.find(d => d.department_id === deptId);
            if (dept) {
              handleExportDeptPDF(dept.department_name, filtered, from, to);
            }
          }}
        >
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>

      {/* ── Summary Cards ── */}
      <SummaryCards rows={filtered} />

      {/* ── Attendance Table grouped by date ── */}
      <AttendanceTable rows={filtered} />

    </div>
  );
}