// employee-report/components/MetricCard.tsx
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  value: string | number;
  sub?:  string;
  icon:  React.ReactNode;
}

export function MetricCard({ title, value, sub, icon }: Props) {
  return (
    <Card className="shadow-none border-border">
      <CardContent className="pt-6 pb-5 px-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-2">{title}</p>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="text-primary mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
