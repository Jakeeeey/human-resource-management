"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, RefreshCw, User, Loader2, ArrowLeft, Search, Building2 } from "lucide-react";
import { Memo, Company, CompanyAcknowledgement } from "../types";

interface MemoAcknowledgementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memo: Memo | null;
    companies: Company[];
    acknowledgementLogs: CompanyAcknowledgement[];
    isLoadingLogs: boolean;
    onRetryCompanyLogs: (companyId: number) => void;
}

export function MemoAcknowledgementDialog({
    open,
    onOpenChange,
    memo,
    companies,
    acknowledgementLogs,
    isLoadingLogs,
    onRetryCompanyLogs
}: MemoAcknowledgementDialogProps) {

    const [selectedCompanyId, setSelectedCompanyId] = React.useState<number | null>(null);
    const [searchQueries, setSearchQueries] = React.useState<Record<number, string>>({});
    const [mobilePane, setMobilePane] = React.useState<"companies" | "users">("companies");

    // Reset selection and pane states when modal opens/closes or memo changes
    React.useEffect(() => {
        if (open) {
            setSelectedCompanyId(null);
            setSearchQueries({});
            setMobilePane("companies");
        }
    }, [open, memo]);

    // Sync selectedCompanyId to the first log once they load
    React.useEffect(() => {
        if (acknowledgementLogs && acknowledgementLogs.length > 0) {
            const exists = acknowledgementLogs.some(log => log.company_id === selectedCompanyId);
            if (!exists) {
                setSelectedCompanyId(acknowledgementLogs[0].company_id);
            }
        } else {
            setSelectedCompanyId(null);
        }
    }, [acknowledgementLogs, selectedCompanyId]);

    const activeLog = acknowledgementLogs.find(l => l.company_id === selectedCompanyId);

    // Compute filtered logs if active log is successful
    const filteredUserLogs = React.useMemo(() => {
        if (!activeLog || activeLog.status !== "success" || !activeLog.acknowledgements) return [];
        const query = (searchQueries[activeLog.company_id] || "").toLowerCase().trim();
        if (!query) return activeLog.acknowledgements;

        return activeLog.acknowledgements.filter(ack => {
            const fullName = [ack.user_fname, ack.user_lname].filter(Boolean).join(" ").toLowerCase();
            const email = (ack.user_email || "").toLowerCase();
            return fullName.includes(query) || email.includes(query);
        });
    }, [activeLog, searchQueries]);

    if (!memo) return null;

    const fromCompany = companies.find((c) => Number(c.company_id) === Number(memo.from));
    const fromLabel = fromCompany ? `${fromCompany.company_name} (${fromCompany.company_code})` : `Company #${memo.from}`;

    // Helper to format Date + Time string (MM/DD/YYYY, hh:mm AM/PM)
    const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return "-";
        
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            const [, year, month, day, hourStr, minute] = match;
            const hour = parseInt(hourStr, 10);
            const ampm = hour >= 12 ? "PM" : "AM";
            const displayHour = hour % 12 === 0 ? 12 : hour % 12;
            return `${month}/${day}/${year}, ${String(displayHour).padStart(2, "0")}:${minute} ${ampm}`;
        }
        
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[750px] max-h-[92vh] flex flex-col p-0 overflow-hidden bg-card text-card-foreground border rounded-2xl shadow-2xl">
                <DialogHeader className="px-5 py-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
                    <DialogTitle className="text-base font-bold tracking-tight">Memo Acknowledgements</DialogTitle>
                </DialogHeader>

                {/* Compact Inline Info Bar */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 shrink-0">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">From</span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5">{fromLabel}</span>
                    </div>
                    <div className="w-px h-7 bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Memo No.</span>
                        <span className="text-[11px] font-bold text-primary mt-0.5">{memo.memo_no}</span>
                    </div>
                    <div className="w-px h-7 bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Subject</span>
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5" title={memo.subject}>{memo.subject}</span>
                    </div>
                    <div className="w-px h-7 bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex flex-col shrink-0">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Released</span>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">{formatDateTime(memo.released_at)}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    <div className="space-y-2">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target Companies Acknowledgment Log</h4>

                        {isLoadingLogs ? (
                            <div className="py-16 flex flex-col items-center justify-center gap-2 border rounded-2xl bg-slate-50/20 dark:bg-slate-950/5">
                                <Loader2 className="h-7 w-7 text-primary animate-spin" />
                                <span className="text-xs font-semibold text-muted-foreground animate-pulse">Aggregating logs from target databases...</span>
                            </div>
                        ) : acknowledgementLogs.length === 0 ? (
                            <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                                No target companies registered or found for this memo.
                            </div>
                        ) : (
                            /* Master-Detail Split Pane Layout */
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-0 h-[480px] border rounded-xl overflow-hidden bg-slate-50/10 dark:bg-slate-950/5 border-slate-200/60 dark:border-slate-800/80">
                                
                                {/* Left Pane (Master List of Companies) */}
                                <div className={`md:col-span-2 flex flex-col border-r border-slate-200/60 dark:border-slate-800/80 h-full overflow-y-auto bg-card p-2 space-y-0.5 shrink-0 ${mobilePane === "users" ? "hidden md:flex" : "flex"}`}>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 py-1 select-none">Select Company</div>
                                    {acknowledgementLogs.map((log) => {
                                        const isActive = log.company_id === selectedCompanyId;
                                        const count = log.acknowledgements?.length || 0;

                                        return (
                                            <div
                                                key={log.company_id}
                                                onClick={() => {
                                                    setSelectedCompanyId(log.company_id);
                                                    setMobilePane("users");
                                                }}
                                                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer border transition-all select-none ${
                                                    isActive 
                                                        ? "bg-primary/[0.06] text-primary border-primary/30 dark:bg-primary/[0.10] dark:border-primary/50 font-bold" 
                                                        : "border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/60"
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <Building2 className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`} />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] truncate leading-tight">{log.company_name}</p>
                                                        <p className="text-[9px] text-muted-foreground font-semibold leading-tight">{log.company_code}</p>
                                                    </div>
                                                </div>

                                                {/* Count Badge / Status indicator */}
                                                <div className="shrink-0 pl-2">
                                                    {log.status === "offline" ? (
                                                        <span className="inline-flex items-center justify-center h-4 px-1 rounded bg-rose-50 text-rose-700 text-[8px] font-black uppercase dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50">
                                                            Off
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded text-[9px] font-bold ${isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                                            {count}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Right Pane (Detail Acknowledged Users List) */}
                                <div className={`md:col-span-3 flex flex-col h-full overflow-hidden bg-card p-3 min-w-0 ${mobilePane === "companies" ? "hidden md:flex" : "flex"}`}>
                                    {/* Mobile Back Button */}
                                    <div className="flex md:hidden items-center pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 gap-1 pl-1 hover:bg-slate-100 text-slate-600 dark:text-slate-400" 
                                            onClick={() => setMobilePane("companies")}
                                        >
                                            <ArrowLeft className="h-3.5 w-3.5" />
                                            <span className="text-xs font-bold">Back to Companies</span>
                                        </Button>
                                    </div>

                                    {activeLog ? (
                                        <div className="flex-1 flex flex-col min-h-0 min-w-0">
                                            {/* Company Title */}
                                            <div className="mb-2 shrink-0 select-none flex items-baseline gap-2">
                                                <h5 className="text-[12px] font-bold text-slate-800 dark:text-slate-200 leading-tight">{activeLog.company_name}</h5>
                                                <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider">{activeLog.company_code} • Logs</p>
                                            </div>

                                            {activeLog.status === "offline" ? (
                                                <div className="flex-1 flex flex-col items-center justify-center p-4 border border-rose-100 rounded-2xl bg-rose-50/10 dark:border-rose-950/30 dark:bg-rose-950/5 space-y-3 text-center select-none">
                                                    <AlertCircle className="h-8 w-8 text-rose-500" />
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Connection Error</p>
                                                        <p className="text-[10px] text-muted-foreground max-w-xs">{activeLog.error || "Cannot connect to the remote database."}</p>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        className="h-8 text-xs font-bold gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                                                        onClick={() => onRetryCompanyLogs(activeLog.company_id)}
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        Retry Connection
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                                                    {/* Real-time search filter */}
                                                    {activeLog.acknowledgements && activeLog.acknowledgements.length > 0 && (
                                                        <div className="relative mb-2 shrink-0">
                                                            <Search className="absolute left-2.5 top-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                                                            <Input
                                                                placeholder="Search user name or email..."
                                                                value={searchQueries[activeLog.company_id] || ""}
                                                                onChange={(e) => setSearchQueries(prev => ({ ...prev, [activeLog.company_id]: e.target.value }))}
                                                                className="pl-7 h-7 text-[11px] bg-slate-50/50 dark:bg-slate-950/20 border-slate-200/80 dark:border-slate-800"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* User List scroll container */}
                                                    <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                                                        {(!activeLog.acknowledgements || activeLog.acknowledgements.length === 0) ? (
                                                            <div className="text-center text-xs text-muted-foreground py-12 italic border border-dashed rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 select-none">
                                                                No users have acknowledged this memo yet.
                                                            </div>
                                                        ) : filteredUserLogs.length === 0 ? (
                                                            <div className="text-center text-xs text-muted-foreground py-12 italic select-none">
                                                                No matching users found for &quot;{searchQueries[activeLog.company_id]}&quot;.
                                                            </div>
                                                        ) : (
                                                            filteredUserLogs.map((ack) => {
                                                                const fullName = [ack.user_fname, ack.user_lname].filter(Boolean).join(" ");
                                                                return (
                                                                    <div 
                                                                        key={ack.id} 
                                                                        className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-card border border-slate-100 dark:border-slate-900/60 text-xs"
                                                                    >
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 shrink-0">
                                                                                <User className="h-3 w-3" />
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate leading-tight">
                                                                                    {fullName || ack.user_email || `User #${ack.user_id}`}
                                                                                </p>
                                                                                {ack.user_email && fullName && (
                                                                                    <p className="text-[9px] text-muted-foreground truncate leading-tight">{ack.user_email}</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[9px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded dark:bg-slate-900 dark:text-slate-400 shrink-0 ml-2 whitespace-nowrap">
                                                                            {formatDateTime(ack.acknowledged_at)}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground select-none">
                                            Select a company to view acknowledgement logs.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/20 border-t shrink-0 flex justify-end gap-2 border-slate-100 dark:border-slate-800">
                    <Button 
                        variant="secondary" 
                        className="px-5 font-bold h-9 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs rounded-xl"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
