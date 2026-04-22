"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { Input }    from '@/components/ui/input';
import { Button }   from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download } from 'lucide-react';
import { useDepartmentReport } from './hooks/useDepartmentReport';
import { toast } from 'sonner';
import { PdfEngine }           from '@/components/pdf-layout-design/PdfEngine';
import { pdfTemplateService }  from '@/components/pdf-layout-design/services/pdf-template';
import autoTable               from 'jspdf-autotable';
import { minsToHM }            from './utils';
import { SummaryCards }        from './components/SummaryCards';
import { AttendanceTable }     from './components/AttendanceTable';

type TableRow = Record<string, unknown>;

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-80 mt-1" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" /><Skeleton className="h-9 w-48" />
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
    return result.data?.[0] ?? null;
  } catch { return null; }
}

function formatDate(ymd: string): string {
  return new Date(ymd + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

async function handleExportDeptPDF(
  deptName: string, rows: TableRow[], from: string, to: string,
) {
  const grouped = new Map<string, TableRow[]>();
  rows.forEach((row) => {
    const date = String(row.log_date ?? '');
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(row);
  });

  const tableData: string[][] = [];
  Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, dateRows]) => {
      dateRows.forEach((row) => {
        tableData.push([
          `${row.user_fname} ${row.user_lname}`,
          String(row.user_position ?? '—'),
          minsToHM(Number(row.work_hours ?? 0)),
          minsToHM(Number(row.overtime   ?? 0)),
          minsToHM(Number(row.late       ?? 0)),
          String(row.punctuality ?? '—'),
          ['On Time', 'Late', 'Present'].includes(String(row.status)) ? 'Present' : String(row.status ?? '—'),
          date,
        ]);
      });
    });

  const presentRows = rows.filter((r) => ['On Time', 'Late', 'Present'].includes(String(r.status)));
  const absentRows  = rows.filter((r) => r.status === 'Absent');
  const totalOT     = rows.reduce((s, r) => s + Number(r.overtime ?? 0), 0);
  const totalLate   = rows.reduce((s, r) => s + Number(r.late     ?? 0), 0);
  const fileName    = `${deptName}_Report_${from}_to_${to}.pdf`;

  try {
    const [companyData, templates] = await Promise.all([
      fetchCompanyData(),
      pdfTemplateService.fetchTemplates(),
    ]);
    const templateName =
      (templates as { name: string }[]).find((t) => t.name === 'Header')?.name ||
      (templates as { name: string }[])[0]?.name ||
      'Department Attendance Report';

    const doc = await PdfEngine.generateWithFrame(
      templateName, companyData,
      (doc, startY, config) => {
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text(deptName, margins.left, startY, { baseline: 'top' });
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Department Attendance Report', margins.left, startY + 8);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text(`Period: ${formatDate(from)} to ${formatDate(to)}`, margins.left, startY + 14);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(
          `Total Present: ${presentRows.length} | Total Absent: ${absentRows.length} | Total OT: ${minsToHM(totalOT)} | Total Late: ${minsToHM(totalLate)}`,
          margins.left, startY + 20,
        );
        autoTable(doc, {
          startY: startY + 26,
          head: [['Name', 'Position', 'Work Hours', 'Overtime', 'Late', 'Punctuality', 'Status', 'Date']],
          body: tableData,
          margin: margins,
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
          bodyStyles: { fontSize: 7.5, valign: 'middle' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didDrawPage: (data: { pageNumber: number }) => {
            const h = doc.internal.pageSize.getHeight();
            const w = doc.internal.pageSize.getWidth();
            doc.setFontSize(8); doc.setTextColor(150);
            doc.text(`Page ${data.pageNumber}`, w / 2, h - 5, { align: 'center' });
            doc.setTextColor(0);
          },
        });
      },
    );

    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) { console.error('PDF error:', err); }
}

// ─── Module ───────────────────────────────────────────────────────────────────

export default function DepartmentReportModule() {
  const yesterday = getYesterdayStr();
  const toastIdRef = useRef<string | number | null>(null);
  const mountedRef = useRef(true);

  // null = no department selected yet
  const [deptId, setDeptId] = useState<number | null>(null);
  const [from,   setFrom]   = useState(yesterday);
  const [to,     setTo]     = useState(yesterday);
  const [search, setSearch] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastIdRef.current) toast.dismiss(toastIdRef.current);
    };
  }, []);

  // Fetch dept list only (pass null so hook skips log fetch)
  const { loadingDepts, departments } = useDepartmentReport(null, from, to);

  // Only fetch logs when a department is explicitly selected
  const logsResult = useDepartmentReport(deptId, from, to);

  useEffect(() => {
    if (!mountedRef.current || deptId === null) return;
    if (logsResult.loading) {
      if (!toastIdRef.current) {
        toastIdRef.current = toast.loading("Fetching department data...");
      }
    } else if (toastIdRef.current) {
      const currentId = toastIdRef.current;
      toast.dismiss(currentId);
      toastIdRef.current = null;
      if (logsResult.error) {
        toast.error(`Error: ${logsResult.error}`);
      } else if (logsResult.rows.length > 0) {
        toast.success(`Loaded ${logsResult.rows.length} records`);
      }
    }
  }, [logsResult.loading, logsResult.error, logsResult.rows.length, deptId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logsResult.rows;
    const q = search.toLowerCase();
    return logsResult.rows.filter((r) =>
      `${r.user_fname} ${r.user_lname}`.toLowerCase().includes(q)
    );
  }, [logsResult.rows, search]);

  if (loadingDepts) return <PageSkeleton />;

  if (logsResult.error) return (
    <div className="p-8 text-center m-8 border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {logsResult.error}</p>
      <Button variant="outline" className="mt-4" onClick={logsResult.refetch}>Retry</Button>
    </div>
  );

  return (
    <div className="p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Department Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Attendance summary grouped by department and date
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* ── Department selector ── */}
        <Select
          value={deptId !== null ? String(deptId) : ''}
          onValueChange={(v) => setDeptId(Number(v))}
        >
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {departments.map((d) => (
              <SelectItem key={d.department_id} value={String(d.department_id)} className="text-sm">
                {d.department_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3">
          <span className="text-sm text-muted-foreground font-medium shrink-0">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent" />
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-background h-9 px-3">
          <span className="text-sm text-muted-foreground font-medium shrink-0">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-auto border-0 p-0 text-sm focus-visible:ring-0 shadow-none w-[130px] bg-transparent" />
        </div>

        <Input placeholder="Search by name…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-[200px] text-sm" />

        {(from !== yesterday || to !== yesterday || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(yesterday); setTo(yesterday); setSearch(''); }}
            className="h-9 px-2.5 text-sm text-muted-foreground hover:text-foreground">
            ✕ Clear
          </Button>
        )}

        <div className="flex-1" />

        <Button
          variant="outline" size="sm"
          className="h-9 px-4 text-sm gap-2"
          disabled={deptId === null}
          onClick={() => {
            const dept = departments.find((d) => d.department_id === deptId);
            if (dept) handleExportDeptPDF(dept.department_name, filtered as unknown as TableRow[], from, to);
          }}
        >
          <Download className="h-4 w-4" /> Export PDF
        </Button>
      </div>

      {/* ── No department selected yet ── */}
      {deptId === null ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <p className="text-base font-medium text-muted-foreground">Select a Department</p>
          <p className="text-sm text-muted-foreground mt-1">Choose a department above to view its attendance report.</p>
        </div>
      ) : logsResult.loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <SummaryCards    rows={filtered} />
          <AttendanceTable rows={filtered} />
        </>
      )}
    </div>
  );
}