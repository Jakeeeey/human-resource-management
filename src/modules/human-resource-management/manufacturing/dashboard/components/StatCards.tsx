import { Users, Target, Package, TrendingUp } from "lucide-react";
import type { DashboardStats } from "../types";
import { formatNumber } from "@/lib/utils";

function formatPercent(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe}%`;
}

interface StatCardsProps {
    stats: DashboardStats;
}

export function StatCards({ stats }: StatCardsProps) {
    const cards = [
        {
            title: "Workforce Attendance",
            value: `${formatNumber(stats.totalWorkingPeople)} / ${formatNumber(stats.totalSetWorkers)}`,
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-600/10",
            description: "Actual vs Set scheduled workers",
        },
        {
            title: "Actual Produce",
            value: formatNumber(stats.totalActualProduce),
            icon: Package,
            color: "text-emerald-600",
            bg: "bg-emerald-600/10",
            description: "Total output produced",
        },
        {
            title: "Target Produce",
            value: formatNumber(stats.totalTargetProduce),
            icon: Target,
            color: "text-amber-600",
            bg: "bg-amber-600/10",
            description: "Expected total output",
        },
        {
            title: "Productivity",
            value: formatPercent(stats.productivityPercentage),
            icon: TrendingUp,
            color: stats.productivityPercentage >= 100 ? "text-emerald-600" : stats.productivityPercentage >= 80 ? "text-amber-600" : "text-rose-600",
            bg: stats.productivityPercentage >= 100 ? "bg-emerald-600/10" : stats.productivityPercentage >= 80 ? "bg-amber-600/10" : "bg-rose-600/10",
            description: "Actual vs Target ratio",
        },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, i) => {
                const Icon = card.icon;
                return (
                    <div key={i} className="rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md group">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${card.bg} transition-transform group-hover:scale-110`}>
                                <Icon className={`h-6 w-6 ${card.color}`} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${card.color.replace('text-', 'bg-')}`} />
                            {card.description}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
