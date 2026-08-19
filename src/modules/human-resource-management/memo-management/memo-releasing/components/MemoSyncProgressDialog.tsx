"use client";

import React from "react";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface SyncItem {
    companyId: number;
    companyName: string;
    companyCode: string;
    status: "pending" | "syncing" | "success" | "failed";
    error?: string;
}

interface MemoSyncProgressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    memoNo: string;
    items: SyncItem[];
    onRetry: (companyId: number) => Promise<void>;
    localReleaseStatus: "idle" | "running" | "success" | "failed";
}

export function MemoSyncProgressDialog({
    open,
    onOpenChange,
    memoNo,
    items,
    onRetry,
    localReleaseStatus
}: MemoSyncProgressDialogProps) {
    const isRunning =
        localReleaseStatus === "running" ||
        items.some((item) => item.status === "syncing");

    const failedCount = items.filter((item) => item.status === "failed").length;
    const successCount = items.filter((item) => item.status === "success").length;
    const totalCount = items.length;

    const getStatusIcon = (status: SyncItem["status"]) => {
        switch (status) {
            case "syncing":
                return <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />;
            case "success":
                return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
            case "failed":
                return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
            default:
                return <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />;
        }
    };

    return (
        <Dialog 
            open={open} 
            onOpenChange={(val) => {
                // Prevent closing while sync is active
                if (!isRunning) {
                    onOpenChange(val);
                }
            }}
        >
            <DialogContent className="sm:max-w-[480px] max-h-[85vh] flex flex-col p-6 overflow-hidden" onPointerDownOutside={(e) => { if (isRunning) e.preventDefault(); }} onEscapeKeyDown={(e) => { if (isRunning) e.preventDefault(); }}>
                <DialogHeader className="shrink-0 space-y-1">
                    <DialogTitle className="text-xl font-bold tracking-tight">Releasing Sync Progress</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Memo No: <span className="font-semibold text-foreground">{memoNo}</span>
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 min-h-0 space-y-4">
                    {/* Local Database Release status */}
                    <div className="flex items-center justify-between border-b pb-3.5">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Local Status Update</span>
                            <span className="text-xs text-muted-foreground">Patching status to &apos;Released&apos; locally</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {localReleaseStatus === "running" && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
                            {localReleaseStatus === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                            {localReleaseStatus === "failed" && <XCircle className="h-5 w-5 text-destructive" />}
                        </div>
                    </div>

                    {/* Remote Company Databases list */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Company Sync Checklist</h4>
                        {items.length === 0 ? (
                            <p className="text-xs italic text-muted-foreground">Loading target companies...</p>
                        ) : (
                            <div className="border rounded-lg divide-y bg-muted/10 overflow-hidden">
                                {items.map((item) => (
                                    <div key={item.companyId} className="flex items-center justify-between p-3.5 text-sm transition-all hover:bg-muted/20">
                                        <div className="flex flex-col min-w-0 pr-4">
                                            <span className="font-medium text-foreground truncate">{item.companyName}</span>
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{item.companyCode}</span>
                                            {item.error && (
                                                <span className="text-xs text-destructive mt-0.5 font-medium leading-tight">
                                                    {item.error}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {getStatusIcon(item.status)}
                                            {item.status === "failed" && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 gap-1.5 hover:bg-primary/5 hover:text-primary transition-all border-dashed"
                                                    onClick={() => onRetry(item.companyId)}
                                                    disabled={isRunning}
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                    Retry
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-background shrink-0">
                    <div className="text-xs text-muted-foreground font-medium">
                        {totalCount > 0 && (
                            <span>
                                Synced: <strong className="text-foreground">{successCount}</strong> / {totalCount}
                                {failedCount > 0 && <span className="text-destructive font-semibold ml-2">({failedCount} failed)</span>}
                            </span>
                        )}
                    </div>
                    <Button 
                        type="button" 
                        onClick={() => onOpenChange(false)} 
                        disabled={isRunning}
                        className={failedCount > 0 ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary text-primary-foreground"}
                    >
                        {isRunning ? "Syncing..." : failedCount > 0 ? "Close with Errors" : "Finish"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
