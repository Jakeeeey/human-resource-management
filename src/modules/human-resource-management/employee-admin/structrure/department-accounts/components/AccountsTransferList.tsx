/**
 * Accounts Transfer List Component
 * Shows assigned and available accounts with add/remove functionality
 */

"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    ChartOfAccount,
    filterAccountsBySearch,
} from "../types";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

interface AccountsTransferListProps {
    assignedAccounts: ChartOfAccount[];
    availableAccounts: ChartOfAccount[];
    onAssignAccount: (coaId: number) => void;
    onUnassignAccount: (coaId: number) => void;
    isAssigning?: boolean;
    isUnassigning?: boolean;
    accountTypeFilter: string;
}

export function AccountsTransferList({
    assignedAccounts,
    availableAccounts,
    onAssignAccount,
    onUnassignAccount,
    isAssigning = false,
    isUnassigning = false,
    accountTypeFilter,
}: AccountsTransferListProps) {
    const [searchAssigned, setSearchAssigned] = useState("");
    const [searchAvailable, setSearchAvailable] = useState("");

    // Map account type ID to distinct styling classes
    const getAccountTypeBadgeStyles = (typeId?: number | null) => {
        if (!typeId) return "bg-muted text-muted-foreground border-border";
        switch (typeId) {
            case 7: // COST OF SALES (Emerald / Green)
                return "bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40";
            case 8: // COST OF SERVICE (Sky / Cyan)
                return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40";
            case 9: // GENERAL AND ADMINISTRATIVE EXPENSES (Violet / Purple)
                return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40";
            case 10: // FINANCE COST (Amber / Orange)
                return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40";
            default:
                return "bg-muted text-muted-foreground border-border";
        }
    };

    // Apply combined search and account type filtering
    const filteredAssigned = useMemo(() => {
        let list = assignedAccounts;
        if (accountTypeFilter !== "all") {
            const typeId = parseInt(accountTypeFilter);
            list = list.filter((acc) => acc.account_type === typeId);
        }
        return filterAccountsBySearch(list, searchAssigned);
    }, [assignedAccounts, accountTypeFilter, searchAssigned]);

    const filteredAvailable = useMemo(() => {
        let list = availableAccounts;
        if (accountTypeFilter !== "all") {
            const typeId = parseInt(accountTypeFilter);
            list = list.filter((acc) => acc.account_type === typeId);
        }
        return filterAccountsBySearch(list, searchAvailable);
    }, [availableAccounts, accountTypeFilter, searchAvailable]);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Assigned Accounts */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Assigned Accounts</span>
                        <Badge 
                            className="bg-primary text-primary-foreground font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xs transition-colors duration-200"
                        >
                            {assignedAccounts.length}
                        </Badge>
                    </CardTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search assigned accounts..."
                            value={searchAssigned}
                            onChange={(e) => setSearchAssigned(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                        {filteredAssigned.length === 0 ? (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No assigned accounts</EmptyTitle>
                                    <EmptyDescription>
                                        {searchAssigned || accountTypeFilter !== "all"
                                            ? "No accounts match your search/filter criteria"
                                            : "No accounts have been assigned to this department yet"}
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : (
                            <div className="space-y-2">
                                {filteredAssigned.map((account) => (
                                    <div
                                        key={account.coa_id}
                                        className="flex items-start justify-between gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate text-primary transition-colors duration-200">
                                                {account.gl_code || "N/A"}
                                            </p>
                                            <p className="text-sm text-foreground truncate font-medium">
                                                {account.account_title || "Untitled"}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                {account.account_type_info && (
                                                    <Badge className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-sm border shadow-2xs", getAccountTypeBadgeStyles(account.account_type))}>
                                                        {account.account_type_info.account_name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => onUnassignAccount(account.coa_id)}
                                            disabled={isUnassigning}
                                            className="shrink-0 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-all hover:scale-110 active:scale-95 h-8 w-8 rounded-lg"
                                        >
                                            {isUnassigning ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Available Accounts */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Available Accounts</span>
                        <Badge 
                            className="bg-primary text-primary-foreground font-mono font-bold px-2.5 py-0.5 rounded-full shadow-xs transition-colors duration-200"
                        >
                            {availableAccounts.length}
                        </Badge>
                    </CardTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search available accounts..."
                            value={searchAvailable}
                            onChange={(e) => setSearchAvailable(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px] pr-4">
                        {filteredAvailable.length === 0 ? (
                            <Empty>
                                <EmptyHeader>
                                    <EmptyTitle>No available accounts</EmptyTitle>
                                    <EmptyDescription>
                                        {searchAvailable || accountTypeFilter !== "all"
                                            ? "No accounts match your search/filter criteria"
                                            : "All accounts have been assigned to this department"}
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        ) : (
                            <div className="space-y-2">
                                {filteredAvailable.map((account) => (
                                    <div
                                        key={account.coa_id}
                                        className="flex items-start justify-between gap-2 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate text-primary transition-colors duration-200">
                                                {account.gl_code || "N/A"}
                                            </p>
                                            <p className="text-sm text-foreground truncate font-medium">
                                                {account.account_title || "Untitled"}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                {account.account_type_info && (
                                                    <Badge className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-sm border shadow-2xs", getAccountTypeBadgeStyles(account.account_type))}>
                                                        {account.account_type_info.account_name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => onAssignAccount(account.coa_id)}
                                            disabled={isAssigning}
                                            className="shrink-0 text-muted-foreground/60 hover:bg-primary/10 hover:text-primary transition-all hover:scale-110 active:scale-95 h-8 w-8 rounded-lg"
                                        >
                                            {isAssigning ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
