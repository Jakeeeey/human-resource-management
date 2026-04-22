"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const createColumns = (
    subsystems: SubsystemRegistration[],
    onToggleAccess: (userId: string, subsystemId: string | number, authorized: boolean) => void,
    onConfigure: (user: UserSubsystemAccess, subsystem: SubsystemRegistration) => void
): ColumnDef<UserSubsystemAccess>[] => [
    {
        accessorKey: "full_name",
        header: "User",
        cell: ({ row }) => {
            const user = row.original;
            const displayName = user.full_name || "Unknown User";
            return (
                <div className="flex flex-col min-w-[200px] py-1">
                    <span className="font-bold text-sm leading-tight">{displayName}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{user.email || "No Email"}</span>
                </div>
            );
        },
    },
    ...subsystems.map((sys): ColumnDef<UserSubsystemAccess> => ({
        id: sys.slug,
        header: () => (
            <div className="text-center px-2 whitespace-nowrap">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/80 cursor-help border-b border-dotted border-primary/20 pb-0.5">
                            {sys.tag || sys.title}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-primary text-primary-foreground text-[10px] font-bold">
                        {sys.title}
                    </TooltipContent>
                </Tooltip>
            </div>
        ),
        cell: ({ row }) => {
            const user = row.original;
            const isAuthorized = (user.authorized_subsystem_ids || []).includes(Number(sys.id));
            
            return (
                <div className="flex items-center justify-center gap-2 min-w-[90px]">
                    <Checkbox
                        checked={isAuthorized}
                        onCheckedChange={(checked) => 
                            onToggleAccess(user.user_id, sys.id, !!checked)
                        }
                        className="h-5 w-5 rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn(
                                    "h-8 w-8 rounded-xl transition-all",
                                    isAuthorized ? "hover:bg-primary/10 hover:text-primary" : "opacity-20 cursor-not-allowed"
                                )}
                                disabled={!isAuthorized}
                                onClick={() => onConfigure(user, sys)}
                            >
                                <Shield className={cn("h-4 w-4", isAuthorized ? "text-primary" : "text-muted-foreground")} />
                            </Button>
                        </TooltipTrigger>
                        {isAuthorized && (
                            <TooltipContent side="right">
                                <p className="text-[10px] font-bold">Configure {sys.title} Permissions</p>
                            </TooltipContent>
                        )}
                    </Tooltip>
                </div>
            );
        },
    })),
];
