"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquareWarning, Clock4, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeConcernProvider } from "./providers/EmployeeConcernProvider";
import { useEmployeeConcern } from "./hooks/useEmployeeConcern";
import { EmployeeConcernTable } from "./components/EmployeeConcernTable";
import { EmployeeConcernDetailDialog } from "./components/EmployeeConcernDetailDialog";

export default function EmployeeConcernPage() {
    return (
        <EmployeeConcernProvider>
            <EmployeeConcernContent />
        </EmployeeConcernProvider>
    );
}

function EmployeeConcernContent() {
    const {
        concerns,
        allConcerns,
        isLoading,
        error,
        refresh,
        isDetailOpen,
        setIsDetailOpen,
        selectedConcern,
        statusFilter,
        setStatusFilter,
        dateRange,
        setDateRange,
        submittedByFilter,
        setSubmittedByFilter,
        handleView,
        handleStatusUpdate,
    } = useEmployeeConcern();

    const stats = React.useMemo(() => {
        const pending = allConcerns.filter((c) => c.status === "PENDING").length;
        const inReview = allConcerns.filter((c) => c.status === "IN_REVIEW").length;
        const resolved = allConcerns.filter((c) => c.status === "RESOLVED").length;
        return { total: allConcerns.length, pending, inReview, resolved };
    }, [allConcerns]);

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employee Concerns</h1>
                    <p className="text-muted-foreground text-sm">
                        Review and process workplace concerns. Entertain and move each item through its action workflow.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={refresh}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="Total"
                    value={stats.total}
                    icon={<MessageSquareWarning className="h-4 w-4" />}
                    tone="default"
                />
                <StatCard
                    label="Pending"
                    value={stats.pending}
                    icon={<Clock4 className="h-4 w-4" />}
                    tone="amber"
                />
                <StatCard
                    label="In Review"
                    value={stats.inReview}
                    icon={<Clock4 className="h-4 w-4" />}
                    tone="blue"
                />
                <StatCard
                    label="Resolved"
                    value={stats.resolved}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="green"
                />
            </div>

            <div className="bg-card rounded-xl border p-4 shadow-sm">
                <EmployeeConcernTable
                    concerns={concerns}
                    isLoading={isLoading}
                    error={error}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    submittedByFilter={submittedByFilter}
                    onSubmittedByFilterChange={setSubmittedByFilter}
                    onView={handleView}
                    onRefresh={refresh}
                />
            </div>

            <EmployeeConcernDetailDialog
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                concern={selectedConcern}
                onStatusUpdate={handleStatusUpdate}
            />
        </div>
    );
}

const TONE_STYLES: Record<string, string> = {
    default: "text-muted-foreground bg-muted/30",
    amber: "text-amber-600 bg-amber-500/10",
    blue: "text-blue-600 bg-blue-500/10",
    green: "text-green-600 bg-green-500/10",
};

function StatCard({
    label,
    value,
    icon,
    tone,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: keyof typeof TONE_STYLES | string;
}) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", TONE_STYLES[tone] ?? TONE_STYLES.default)}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums leading-none">{value}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mt-1">
                    {label}
                </span>
            </div>
        </div>
    );
}
