/**
 * Accounts Transfer List Component
 * Shows assigned and available accounts with add/remove functionality
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, X, Loader2 } from "lucide-react";
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
}

export function AccountsTransferList({
    assignedAccounts,
    availableAccounts,
    onAssignAccount,
    onUnassignAccount,
    isAssigning = false,
    isUnassigning = false,
}: AccountsTransferListProps) {
    const [searchAssigned, setSearchAssigned] = useState("");
    const [searchAvailable, setSearchAvailable] = useState("");

    const filteredAssigned = filterAccountsBySearch(assignedAccounts, searchAssigned);
    const filteredAvailable = filterAccountsBySearch(availableAccounts, searchAvailable);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Assigned Accounts */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Assigned Accounts</span>
                        <Badge variant="secondary">{assignedAccounts.length}</Badge>
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
                                        {searchAssigned
                                            ? "No accounts match your search"
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
                                            <p className="font-medium text-sm truncate">
                                                {account.gl_code || "N/A"}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {account.account_title || "Untitled"}
                                            </p>
                                            {account.account_type_info && (
                                                <Badge variant="outline" className="mt-1 text-xs">
                                                    {account.account_type_info.account_name}
                                                </Badge>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onUnassignAccount(account.coa_id)}
                                            disabled={isUnassigning}
                                            className="shrink-0"
                                        >
                                            {isUnassigning ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <X className="h-4 w-4" />
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
                        <Badge variant="secondary">{availableAccounts.length}</Badge>
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
                                        {searchAvailable
                                            ? "No accounts match your search"
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
                                            <p className="font-medium text-sm truncate">
                                                {account.gl_code || "N/A"}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {account.account_title || "Untitled"}
                                            </p>
                                            {account.account_type_info && (
                                                <Badge variant="outline" className="mt-1 text-xs">
                                                    {account.account_type_info.account_name}
                                                </Badge>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onAssignAccount(account.coa_id)}
                                            disabled={isAssigning}
                                            className="shrink-0"
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
