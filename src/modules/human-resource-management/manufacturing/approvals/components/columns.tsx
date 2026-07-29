/* eslint-disable */
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, XCircle, ArrowDownCircle, Users, Factory, AlertTriangle, PhilippinePeso } from "lucide-react";
import type { PendingApprovalItem } from "../types";
import { format } from "date-fns";

export const createColumns = (
    onApprove: (scheduleId: number, overrides?: any) => void,
    onReject: (scheduleId: number) => void,
    onApproveWarning: (scheduleId: number, suggestedTarget: number, currentTarget: number, positions: any[], targetLaborCost: number, baseTotalRate: number) => void
): ColumnDef<PendingApprovalItem>[] => [
    {
        accessorKey: "date",
        header: "Schedule Date",
        cell: ({ row }) => {
            const dateStr = row.original.date;
            let formattedDate = dateStr;
            try {
                formattedDate = format(new Date(dateStr), "MMM dd, yyyy");
            } catch {}
            return (
                <div className="flex items-center gap-3 py-1">
                    <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                        <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-extrabold text-[13px] text-foreground tracking-tight">
                        {formattedDate}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "line_name",
        header: "Production Line",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <div className="bg-primary/5 p-2 rounded-xl border border-primary/10">
                    <Factory className="h-4 w-4 text-primary" />
                </div>
                <span className="font-bold text-xs tracking-tight text-foreground truncate max-w-[150px]">
                    {row.original.line_name}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "created_by",
        header: "Requested By",
        cell: ({ row }) => {
            const rawSched = row.original.raw_schedule as any;
            const creator = rawSched.user_created || rawSched.created_by;
            
            let creatorName = "System";
            let initials = "S";
            
            if (creator && typeof creator === "object" && (creator.first_name || creator.last_name)) {
                creatorName = `${creator.first_name || ""} ${creator.last_name || ""}`.trim();
                initials = (creator.first_name?.[0] || "") + (creator.last_name?.[0] || "");
            } else if (creator) {
                creatorName = `User #${creator}`;
                initials = creator.toString().substring(0, 2);
            }

            return (
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary uppercase">
                        {initials || "U"}
                    </div>
                    <span className="font-semibold text-[11px] text-muted-foreground truncate max-w-[100px]">
                        {creatorName}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "type",
        header: "Override Issues",
        cell: ({ row }) => {
            const dev = row.original.deviations;
            const issues = [];
            
            // Check for labor cost over budget
            const rawPositions = row.original.raw_schedule?.positions || row.original.raw_schedule?.manu_hr_schedule_positions || [];
            const uniqueMap = new Map<number, typeof rawPositions[0]>();
            rawPositions.forEach((p) => {
                uniqueMap.set(p.position_id, p);
            });
            const positions = Array.from(uniqueMap.values());
            const totalRate = positions.reduce((sum, pos) => sum + ((pos.assigned_persons || 0) * (pos.position?.position_rate || 0)), 0);
            const targetPcs = row.original.raw_schedule?.daily_target || 0;
            const laborCostPerPcs = targetPcs > 0 ? totalRate / targetPcs : 0;
            const targetLaborCost = row.original.raw_schedule?.line?.target_labor_cost || 0;
            const isOverBudget = targetLaborCost > 0 && laborCostPerPcs > targetLaborCost;

            if (isOverBudget) {
                issues.push(
                    <span key="labor" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-500/25 bg-red-500/5 text-[9px] font-black text-red-700 uppercase tracking-wider">
                        <AlertTriangle className="h-3 w-3" /> High Labor Cost
                    </span>
                );
            }

            if (dev.target) {
                issues.push(
                    <span key="target" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] font-black text-amber-700 uppercase tracking-wider">
                        <ArrowDownCircle className="h-3 w-3" /> Target Deviation
                    </span>
                );
            }
            const overrides = dev.headcounts?.filter(h => h.assigned > h.allowed) || [];
            if (overrides.length > 0) {
                issues.push(
                    <span key="headcount" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-orange-500/25 bg-orange-500/5 text-[9px] font-black text-orange-700 uppercase tracking-wider">
                        <Users className="h-3 w-3" /> Headcount Override ({overrides.length})
                    </span>
                );
            }
            return (
                <div className="flex flex-col gap-1.5 items-start">
                    {issues}
                </div>
            );
        },
    },
    {
        id: "details",
        header: "Deviation Details",
        cell: ({ row }) => {
            const dev = row.original.deviations;
            const rawPositions = row.original.raw_schedule?.positions || row.original.raw_schedule?.manu_hr_schedule_positions || [];
            
            // Calculate Labor Cost
            const uniqueMap = new Map<number, typeof rawPositions[0]>();
            rawPositions.forEach((p) => {
                uniqueMap.set(p.position_id, p);
            });
            const positions = Array.from(uniqueMap.values());
            
            const totalRate = positions.reduce((sum, pos) => sum + ((pos.assigned_persons || 0) * (pos.position?.position_rate || 0)), 0);
            const targetPcs = row.original.raw_schedule?.daily_target || 0;
            const laborCostPerPcs = targetPcs > 0 ? totalRate / targetPcs : 0;
            
            // Getting target labor cost from manufacturing lines
            const lineData = row.original.raw_schedule?.line;
            const targetLaborCost = lineData?.target_labor_cost || 0;
            
            const isOverBudget = targetLaborCost > 0 && laborCostPerPcs > targetLaborCost;
            const suggestedTarget = targetLaborCost > 0 ? Math.ceil(totalRate / targetLaborCost) : 0;
            
            return (
                <div className="flex flex-col gap-2 py-1 max-w-[250px]">
                    {/* Labor Cost Section */}
                    {targetLaborCost > 0 && (
                        <div className={`flex flex-col gap-0.5 pb-1.5 border-b border-muted-foreground/10 last:border-0 last:pb-0 ${isOverBudget ? 'bg-destructive/10 p-2 rounded-lg -mx-2 border-transparent' : ''}`}>
                            <span className={`font-bold text-xs flex items-center gap-1 ${isOverBudget ? 'text-destructive' : 'text-foreground'}`}>
                                <PhilippinePeso className={`h-3 w-3 ${isOverBudget ? 'text-destructive' : 'text-blue-500'}`} /> Cost/Pcs: ₱{laborCostPerPcs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                            </span>
                            <span className={`text-[10px] font-semibold ${isOverBudget ? 'text-destructive/80' : 'text-muted-foreground'}`}>
                                Target Limit is ₱{targetLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} 
                                {isOverBudget && <span className="text-destructive font-black ml-1">(OVER BUDGET)</span>}
                            </span>
                        </div>
                    )}

                    {dev.target && (
                        <div className="flex flex-col gap-0.5 pb-1.5 border-b border-muted-foreground/10 last:border-0 last:pb-0">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1">
                                <ArrowDownCircle className="h-3 w-3 text-amber-500" /> Target: {dev.target.requested.toLocaleString()} pcs
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold">
                                Standard is {dev.target.standard.toLocaleString()} pcs (Diff: -{dev.target.standard - dev.target.requested} pcs)
                            </span>
                        </div>
                    )}
                    
                    {dev.headcounts && dev.headcounts.map((hc, idx) => {
                        const isOverride = hc.assigned > hc.allowed;
                        return (
                            <div key={idx} className="flex flex-col gap-0.5 pb-1.5 border-b border-muted-foreground/10 last:border-0 last:pb-0">
                                    <span className={`font-bold text-xs flex items-center gap-1 ${isOverride ? 'text-foreground' : 'text-muted-foreground'}`}>
                                        <Users className={`h-3 w-3 ${isOverride ? 'text-orange-500' : 'text-muted-foreground/60'}`} /> {hc.position_name}: {hc.assigned} persons
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-semibold">
                                        Allowed Limit is {hc.allowed} max {isOverride && <span className="text-orange-600 font-bold">(Override: +{hc.assigned - hc.allowed})</span>}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            );
        },
    },
    {
        id: "actions",
        header: "Review Actions",
        cell: ({ row }) => {
            const item = row.original;
            
            const rawPositions = item.raw_schedule?.positions || item.raw_schedule?.manu_hr_schedule_positions || [];
            const uniqueMap = new Map<number, typeof rawPositions[0]>();
            rawPositions.forEach((p) => {
                uniqueMap.set(p.position_id, p);
            });
            const positions = Array.from(uniqueMap.values());
            const totalRate = positions.reduce((sum, pos) => sum + ((pos.assigned_persons || 0) * (pos.position?.position_rate || 0)), 0);
            const targetPcs = item.raw_schedule?.daily_target || 0;
            const laborCostPerPcs = targetPcs > 0 ? totalRate / targetPcs : 0;
            const targetLaborCost = item.raw_schedule?.line?.target_labor_cost || 0;
            const isOverBudget = targetLaborCost > 0 && laborCostPerPcs > targetLaborCost;
            const suggestedTarget = targetLaborCost > 0 ? Math.ceil(totalRate / targetLaborCost) : 0;

            const handleApprove = () => {
                if (isOverBudget) {
                    const enrichedPositions = (item.deviations.headcounts || []).map(hc => {
                        const raw = positions.find(p => p.id === hc.position_item_id || p.position?.position_name === hc.position_name);
                        return {
                            ...hc,
                            position_rate: raw?.position?.position_rate || 0
                        };
                    });
                    onApproveWarning(item.schedule_id, suggestedTarget, targetPcs, enrichedPositions, targetLaborCost, totalRate);
                } else {
                    onApprove(item.schedule_id);
                }
            };

            return (
                <div className="flex items-center gap-2">
                    <Button
                        size="xs"
                        onClick={handleApprove}
                        className="h-7 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest gap-1 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                        size="xs"
                        variant="outline"
                        onClick={() => onReject(item.schedule_id)}
                        className="h-7 px-3.5 rounded-xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white text-[9px] font-black uppercase tracking-widest gap-1 active:scale-95 transition-all"
                    >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                    </Button>
                </div>
            );
        },
    },
];
