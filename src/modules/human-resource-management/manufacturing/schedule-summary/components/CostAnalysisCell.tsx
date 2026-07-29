"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TriangleAlert, CheckCircle2 } from "lucide-react";
import type { ProductionSchedule } from "../../production-scheduling/types";

interface CostAnalysisModalProps {
    schedule: ProductionSchedule | null;
    isOpen: boolean;
    onClose: () => void;
}

export function CostAnalysisModal({ schedule, isOpen, onClose }: CostAnalysisModalProps) {
    if (!schedule) return null;

    const actual = schedule.actual_produce || 0;
    const target = schedule.daily_target || 0;
    const positions = schedule.positions || schedule.manu_hr_schedule_positions || [];

    let workingHours = 8;
    let elapsedHours = 9;
    if (schedule.start_time && schedule.end_time) {
        const start = schedule.start_time.split(":");
        const end = schedule.end_time.split(":");
        const startH = parseInt(start[0], 10) + parseInt(start[1], 10) / 60;
        const endH = parseInt(end[0], 10) + parseInt(end[1], 10) / 60;
        elapsedHours = endH > startH ? endH - startH : (endH + 24) - startH;
        workingHours = Math.max(0, elapsedHours - 1);
    }

    const actualTotalCost = positions.reduce((acc: number, p: { position?: { position_rate?: string | number, position_name?: string }, assigned_persons?: string | number }) => {
        const dailyRate = Number(p.position?.position_rate || 0);
        const hourlyRate = dailyRate / 8;
        const persons = Number(p.assigned_persons || 0);
        return acc + (persons * hourlyRate * workingHours);
    }, 0);

    const targetCpp = target > 0 ? actualTotalCost / target : 0;
    const actualCpp = actual > 0 ? actualTotalCost / actual : 0;
    
    const budgetEarned = actual * targetCpp;
    const totalVariance = budgetEarned - actualTotalCost;
    const isOver = totalVariance < -0.01;

    const formatVariance = (val: number) => {
        if (val < 0) return `-₱${Math.abs(val).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        return `+₱${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="p-0 overflow-hidden max-w-2xl border-0 shadow-2xl gap-0 max-h-[90vh] flex flex-col [&>button]:top-6 [&>button]:right-6">
                <DialogTitle className="sr-only">
                    {isOver ? 'High Labor Cost Warning' : 'Optimal Labor Cost'}
                </DialogTitle>
                <DialogDescription className="sr-only">
                    Detailed breakdown of production efficiency and labor cost.
                </DialogDescription>
                
                {/* TOP BANNER */}
                <div className={`shrink-0 px-8 py-6 flex items-center gap-4 border-b ${isOver ? 'bg-red-50/80 border-red-100' : 'bg-emerald-50/80 border-emerald-100'}`}>
                    <div className={`p-3 rounded-full flex-shrink-0 ${isOver ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {isOver ? <TriangleAlert className="h-8 w-8" strokeWidth={2.5} /> : <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />}
                    </div>
                    <div className="space-y-1">
                        <h2 className={`text-[24px] font-black tracking-tight leading-none ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                            {isOver ? 'High Labor Cost Warning' : 'Optimal Labor Cost'}
                        </h2>
                        <p className={`text-[11px] font-black tracking-[0.1em] uppercase ${isOver ? 'text-red-500' : 'text-emerald-500'}`}>
                            {isOver ? 'Budget Exceeded' : 'Within Budget'}
                        </p>
                    </div>
                </div>

                {/* SCROLLABLE BODY */}
                <div className="p-8 space-y-8 bg-background overflow-y-auto">
                    <p className="text-[16px] font-semibold text-foreground">
                        {actual === 0 && actualTotalCost > 0
                            ? <span>This schedule <strong className="text-red-600">recorded zero output</strong> but consumed labor budget.</span>
                            : isOver 
                                ? <span>You are viewing a schedule that <strong className="text-red-600">exceeds the target labor cost budget</strong>.</span>
                                : <span>You are viewing a schedule that <strong className="text-emerald-600">is within the target labor cost budget</strong>.</span>}
                    </p>

                    <div className="rounded-2xl border border-muted/60 p-6 space-y-6 shadow-sm">
                        <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
                            {actual === 0 && actualTotalCost > 0
                                ? "No production output was recorded for this schedule, resulting in a total loss of the allocated labor cost."
                                : isOver 
                                    ? "The estimated labor cost per piece is significantly higher than the standard limit because the actual output was too low for the assigned headcounts."
                                    : "The estimated labor cost per piece is optimal because the actual output met or exceeded expectations for the assigned headcounts."}
                        </p>

                        <div className="grid grid-cols-4 gap-6 pt-2">
                            <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Target Limit</span>
                                <span className="text-lg font-black text-foreground">₱{targetCpp.toFixed(4)}</span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Actual Cost/Pcs</span>
                                <span className={`text-lg font-black ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {actual > 0 ? `₱${actualCpp.toFixed(4)}` : 'N/A'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Actual Output</span>
                                <span className={`text-lg font-black ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>{actual.toLocaleString()} pcs</span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground block">Over Budget</span>
                                <span className={`text-lg font-black whitespace-nowrap ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatVariance(totalVariance)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[12px] font-black tracking-widest uppercase text-muted-foreground">Assigned Headcounts</h4>
                        <div className="rounded-2xl border border-muted/60 overflow-hidden shadow-sm">
                            <table className="w-full text-[13px]">
                                <thead className="bg-muted/10">
                                    <tr>
                                        <th className="text-left font-black text-[10px] uppercase tracking-widest text-muted-foreground px-5 py-3.5 border-b">Position</th>
                                        <th className="text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground px-5 py-3.5 border-b">Rate (₱)</th>
                                        <th className="text-center font-black text-[10px] uppercase tracking-widest text-muted-foreground px-5 py-3.5 border-b">Assigned</th>
                                        <th className="text-right font-black text-[10px] uppercase tracking-widest text-muted-foreground px-5 py-3.5 border-b">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted/40">
                                    {positions.map((p: { position?: { position_name?: string, position_rate?: string | number }, assigned_persons?: string | number }, idx: number) => {
                                        const dailyRate = Number(p.position?.position_rate || 0);
                                        const hourlyRate = dailyRate / 8;
                                        const assigned = Number(p.assigned_persons || 0);
                                        const posCost = hourlyRate * assigned * workingHours;
                                        return (
                                            <tr key={idx} className="hover:bg-muted/5 transition-colors">
                                                <td className="px-5 py-4 font-semibold text-foreground">{p.position?.position_name || 'Unknown'}</td>
                                                <td className="px-5 py-4 text-center tabular-nums text-muted-foreground font-medium">₱{dailyRate.toFixed(2)}</td>
                                                <td className="px-5 py-4 text-center tabular-nums font-bold text-foreground">{assigned}</td>
                                                <td className="px-5 py-4 text-right tabular-nums font-semibold text-muted-foreground">₱{posCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-muted/5 border-t-2">
                                        <td colSpan={3} className="px-5 py-4 text-right font-black text-[11px] tracking-widest uppercase text-muted-foreground">Est. Total Labor Cost</td>
                                        <td className="px-5 py-4 text-right font-black tabular-nums text-[15px]">₱{actualTotalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <Button onClick={onClose} variant="outline" className="font-bold tracking-widest uppercase px-10 rounded-xl h-12">
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
