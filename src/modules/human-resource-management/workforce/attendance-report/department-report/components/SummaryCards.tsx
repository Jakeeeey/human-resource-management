// department-report/components/SummaryCards.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Clock, TrendingUp, Star } from 'lucide-react';
import { minsToHM, getConsistentlyOnTime } from '../utils';
import type { DeptAttendanceRow } from '../hooks/useDepartmentReport';

interface Props { rows: DeptAttendanceRow[] }

export function SummaryCards({ rows }: Props) {
  const totalOvertime = rows.reduce((s, r) => s + r.overtime, 0);
  const totalLate     = rows.reduce((s, r) => s + r.late, 0);
  const onTimeNames   = getConsistentlyOnTime(rows);

  return (
    <div className="space-y-4">
      {/* Overtime + Late */}
      <div className="grid gap-4 grid-cols-2 w-full">
        <Card className="shadow-none border-border">
          <CardContent className="pt-6 pb-5 px-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Overtime (hrs)</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{minsToHM(totalOvertime)}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardContent className="pt-6 pb-5 px-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Late (hrs)</p>
                <p className="text-2xl font-bold text-foreground tracking-tight">{minsToHM(totalLate)}</p>
              </div>
              <Clock className="h-4 w-4 text-primary mt-0.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consistently On Time */}
      {onTimeNames.length > 0 && (
        <Card className="shadow-none border-border">
          <CardContent className="pt-4 pb-4 px-6">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold text-foreground">Consistently On Time</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {onTimeNames.length} employee{onTimeNames.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {onTimeNames.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 font-medium"
                >
                  {name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
