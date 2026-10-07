"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpDown, 
  ScanFace, 
  ShieldCheck, 
  Clock, 
  MoreHorizontal, 
  RefreshCw, 
  Trash2, 
  Eye
} from "lucide-react";
import type { User, Department } from "../types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EmployeeWithFace = User & { 
  hasFaceBiometric?: boolean; 
  image_reference_path?: string | null;
};

export const createColumns = (
    onScanFace: (employee: EmployeeWithFace) => void,
    onRemoveBiometric?: (employee: EmployeeWithFace) => void,
    departments: Department[] = []
): ColumnDef<EmployeeWithFace>[] => {
    const ASSETS_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") + "/assets";

    return [
    {
        accessorKey: "full_name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-primary/10 -ml-4 rounded-xl font-semibold transition-colors"
                >
                    Employee
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const user = row.original;
            const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;
            const faceImageUrl = user.image_reference_path 
                ? `${ASSETS_URL}/${user.image_reference_path}` 
                : `https://api.dicebear.com/7.x/initials/svg?seed=${initials}`;

            return (
                <div className="flex items-center gap-3.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-pointer group">
                            <Avatar className="h-11 w-11 ring-2 ring-primary/10 transition-all group-hover:ring-primary/40 group-hover:scale-105">
                                <AvatarImage 
                                  src={faceImageUrl} 
                                  alt={`${user.firstName} ${user.lastName}`} 
                                  className="object-cover" 
                                />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{initials}</AvatarFallback>
                            </Avatar>
                            {user.hasFaceBiometric && (
                              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-background flex items-center justify-center">
                                <ShieldCheck className="h-2.5 w-2.5 text-white" />
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        {user.hasFaceBiometric && (
                          <TooltipContent side="right" className="text-xs">
                            Registered Biometric Photo Active
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>

                    <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground tracking-tight truncate">
                            {user.firstName} {user.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
                            {user.email || "No email on record"}
                        </span>
                    </div>
                </div>
            );
        },
        filterFn: (row, id, filterValue) => {
            const name = `${row.original.firstName} ${row.original.lastName}`.toLowerCase();
            return name.includes((filterValue as string).toLowerCase());
        },
    },
    {
        accessorKey: "department",
        header: "Department & Role",
        cell: ({ row }) => {
            const deptId = row.original.department;
            const deptName = departments.find(d => d.department_id.toString() === deptId?.toString())?.department_name || deptId || "Unassigned";
            return (
                <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground text-sm">{deptName}</span>
                    <span className="text-xs text-muted-foreground">{row.original.position || "General Staff"}</span>
                </div>
            );
        },
        filterFn: (row, id, value) => {
            if (!value || value === "all") return true;
            return row.original.department?.toString() === value.toString();
        },
    },
    {
        accessorKey: "status",
        header: "Enrollment Status",
        cell: ({ row }) => {
            const isRegistered = !!row.original.hasFaceBiometric;
            return (
                <div className="flex items-center">
                    {isRegistered ? (
                      <Badge 
                        variant="outline" 
                        className="bg-emerald-500/10 text-emerald-700 border-emerald-500/25 px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Enrolled</span>
                      </Badge>
                    ) : (
                      <Badge 
                        variant="outline" 
                        className="bg-amber-500/10 text-amber-700 border-amber-500/25 px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <span>Pending</span>
                      </Badge>
                    )}
                </div>
            );
        },
        filterFn: (row, id, value) => {
            if (!value || value === "all") return true;
            const isRegistered = !!row.original.hasFaceBiometric;
            const matchValue = value === "registered";
            return isRegistered === matchValue;
        },
    },
    {
        id: "actions",
        header: () => <div className="text-right pr-4">Actions</div>,
        cell: ({ row }) => {
            const user = row.original;
            const isRegistered = !!user.hasFaceBiometric;

            return (
                <div className="flex items-center justify-end gap-2 pr-2">
                    {!isRegistered ? (
                        <Button 
                            size="sm" 
                            onClick={() => onScanFace(user)}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs gap-1.5 h-8 px-3"
                        >
                            <ScanFace className="h-3.5 w-3.5" />
                            Enroll Face
                        </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onScanFace(user)}
                          className="h-8 rounded-xl text-xs gap-1.5 hover:bg-primary/5 hover:text-primary border-primary/25"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Update Face
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                            <DropdownMenuItem 
                              onClick={() => onScanFace(user)}
                              className="text-xs cursor-pointer gap-2"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View / Retake Face</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => onRemoveBiometric?.(user)}
                              className="text-xs cursor-pointer gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Remove Biometric</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                </div>
            );
        },
    },
];
};
