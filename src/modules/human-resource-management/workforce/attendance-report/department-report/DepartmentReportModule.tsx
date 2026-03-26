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

type TableRow = Record<string, unknown>;

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

function formatDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function handleExportDeptPDF(deptName: string, rows: TableRow[], from: string, to: string) {
  const groupByDate = (r: TableRow[]) => {
    const map = new Map<string, TableRow[]>();
    r.forEach(row => {
      const date = String(row.log_date ?? '');
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(row);
    });
    return map;
  };

  const grouped = groupByDate(rows);

  const tableData: string[][] = [];
  Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dateRows]) => {
    dateRows.forEach(row => {
      tableData.push([
        `${row.user_fname} ${row.user_lname}`,
        String(row.user_position ?? '—'),
        minsToHM(Number(row.work_hours ?? 0)),
        minsToHM(Number(row.overtime ?? 0)),
        minsToHM(Number(row.late ?? 0)),
        String(row.punctuality ?? '—'),
        ['On Time', 'Late'].includes(String(row.status)) ? 'Present' : String(row.status ?? '—'),
        date,
      ]);
    });
  });

  const presentStatus = rows.filter(r => ['On Time', 'Late'].includes(String(r.status)));
  const absent        = rows.filter(r => r.status === 'Absent');
  const totalOvertMin = rows.reduce((s, r) => s + Number(r.overtime ?? 0), 0);
  const totalLateMins = rows.reduce((s, r) => s + Number(r.late ?? 0), 0);

  const fileName = `${deptName}_Report_${from}_to_${to}.pdf`;

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);

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

        const headerLineY = startY + 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Department Attendance Report`, margins.left, headerLineY);
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(9);
        doc.text(`Period: ${formatDate(from)} to ${formatDate(to)}`, margins.left, headerLineY + 6);

        const summaryY = headerLineY + 12;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(
          `Total Present Days: ${presentStatus.length} | Total Absent Days: ${absent.length} | Total OT: ${minsToHM(totalOvertMin)} | Total Late: ${minsToHM(totalLateMins)}`,
          margins.left, summaryY
        );

        autoTable(doc, {
          startY: summaryY + 4,
          head: [['Name', 'Position', 'Work Hours', 'Overtime', 'Late', 'Punctuality', 'Status', 'Date']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          tableWidth: 'auto',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
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
  }
}

export default function DepartmentReportModule() {
  const yesterday = getYesterdayStr();

  const [deptId, setDeptId] = useState<number | null>(null);
  const [from,   setFrom]   = useState(yesterday);
  const [to,     setTo]     = useState(yesterday);
  const [search, setSearch] = useState('');

  const { loading, error, rows, departments, refetch } = useDepartmentReport(deptId, from, to);

  // Default to first department once loaded — use functional update to avoid
  // reading deptId in the dependency array (prevents the setState-in-effect warning)
  useEffect(() => {
    if (departments.length > 0) {
      setDeptId((prev) => (prev === null ? departments[0].department_id : prev));
    }
  }, [departments]);

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

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Department Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Attendance summary grouped by department and date</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={deptId ? String(deptId) : ''}
          onValueChange={(v) => setDeptId(Number(v))}
        >
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <SelectValue placeholder="Select department…" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {departments.map((d) => (
              <SelectItem key={`dept-${d.department_id}`} value={String(d.department_id)} className="text-sm">
                {d.department_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3 min-w-0">
          <span className="text-sm text-muted-foreground font-medium shrink-0">From</span>
          <Input
            type="date" value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3 min-w-0">
          <span className="text-sm text-muted-foreground font-medium shrink-0">To</span>
          <Input
            type="date" value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>

        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-[200px] text-sm"
        />

        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}
            className="h-9 px-2.5 text-sm text-muted-foreground hover:text-foreground">
            ✕ Clear
          </Button>
        )}

        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-9 px-4 text-sm gap-2"
          onClick={() => {
            const dept = departments.find(d => d.department_id === deptId);
            if (dept) handleExportDeptPDF(dept.department_name, filtered as TableRow[], from, to);
          }}
        >
          <Download className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      <SummaryCards rows={filtered} />
      <AttendanceTable rows={filtered} />
    </div>
  );
}