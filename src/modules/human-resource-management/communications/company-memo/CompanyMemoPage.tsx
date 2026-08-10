"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Megaphone, FileText, CheckCircle2, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyMemoProvider } from "./providers/CompanyMemoProvider";
import { useCompanyMemo } from "./hooks/useCompanyMemo";
import { CreateCompanyMemoDialog } from "./components/CreateCompanyMemoDialog";

export default function CompanyMemoPage() {
    return (
        <CompanyMemoProvider>
            <CompanyMemoContent />
        </CompanyMemoProvider>
    );
}

function CompanyMemoContent() {
    const {
        memos,
        allMemos,
        isLoading,
        refresh,
        isCreateOpen,
        setIsCreateOpen,
    } = useCompanyMemo();

    const stats = React.useMemo(() => {
        const draft = allMemos.filter((m) => m.status === "DRAFT").length;
        const published = allMemos.filter((m) => m.status === "PUBLISHED").length;
        const archived = allMemos.filter((m) => m.status === "ARCHIVED").length;
        return { total: allMemos.length, draft, published, archived };
    }, [allMemos]);

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Company Memos</h1>
                    <p className="text-muted-foreground text-sm">
                        Manage and broadcast company-wide announcements.
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
                    <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
                        <Megaphone className="h-4 w-4" />
                        Create Memo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label="Total Memos"
                    value={stats.total}
                    icon={<FileText className="h-4 w-4" />}
                    tone="default"
                />
                <StatCard
                    label="Drafts"
                    value={stats.draft}
                    icon={<FileText className="h-4 w-4" />}
                    tone="amber"
                />
                <StatCard
                    label="Published"
                    value={stats.published}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    tone="green"
                />
                <StatCard
                    label="Archived"
                    value={stats.archived}
                    icon={<FileArchive className="h-4 w-4" />}
                    tone="blue"
                />
            </div>

            <div className="bg-card rounded-xl border p-4 shadow-sm flex flex-col gap-4">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground text-center py-10">Loading memos...</div>
                ) : memos.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-10">No memos found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Title</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Priority</th>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {memos.map((memo) => (
                                    <tr key={memo.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium">{memo.title}</td>
                                        <td className="px-4 py-3">
                                            <span className="bg-muted px-2 py-1 rounded-md text-xs">{memo.status}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-muted px-2 py-1 rounded-md text-xs">{memo.priority}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {memo.created_at ? new Date(memo.created_at).toLocaleDateString() : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CreateCompanyMemoDialog 
                open={isCreateOpen} 
                onOpenChange={setIsCreateOpen} 
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
