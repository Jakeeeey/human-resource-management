"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserSubsystemAccess } from "../types";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";

export const createColumns = (
    subsystems: SubsystemRegistration[],
    onToggleAccess: (userId: string, subsystemId: string, authorized: boolean) => void,
    onConfigure: (user: UserSubsystemAccess, subsystem: SubsystemRegistration) => void
): ColumnDef<UserSubsystemAccess>[] => [
    {
        accessorKey: "full_name",
        header: "User",
        cell: ({ row }) => {
            const user = row.original;
            return (
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{user.full_name}</span>
                    <span className="text-[10px] text-muted-foreground">{user.email}</span>
                </div>
            );
        },
    },
    ...subsystems.map((sys): ColumnDef<UserSubsystemAccess> => ({
        id: sys.slug,
        header: sys.title,
        cell: ({ row }) => {
            const user = row.original;
            const isAuthorized = user.authorized_subsystems.includes(sys.slug);
            
            return (
                <div className="flex items-center justify-center gap-2">
                    <Checkbox
                        checked={isAuthorized}
                        onCheckedChange={(checked) => 
                            onToggleAccess(user.user_id, sys.slug, !!checked)
                        }
                    />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7" 
                        disabled={!isAuthorized}
                        onClick={() => onConfigure(user, sys)}
                    >
                        <Shield className={isAuthorized ? "h-3.5 w-3.5 text-primary" : "h-3.5 w-3.5 text-muted-foreground/30"} />
                    </Button>
                </div>
            );
        },
    })),
];
