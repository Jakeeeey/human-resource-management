/* eslint-disable */
"use client";

import { Sparkles, TrendingDown, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, Activity, Users, DollarSign } from "lucide-react";
import type { DashboardStats } from "../types";
import { formatNumber } from "@/lib/utils";

interface AiInsightsCardProps {
    stats: DashboardStats;
}

export function AiInsightsCard({ stats }: AiInsightsCardProps) {
    if (!stats || (stats.totalTargetProduce === 0 && stats.totalActualProduce === 0)) {
        return null;
    }

    const { productivityPercentage, totalWorkingPeople: actualWorkers, totalSetWorkers: setWorkers } = stats;
    
    let overallStatus: "excellent" | "warning" | "critical" = "excellent";
    let title = "";
    let summary = "";
    
    const recommendations: string[] = [];
    const keyFindings: { icon: any, text: string, type: "positive" | "negative" | "neutral" }[] = [];

    const overstaffedCount = actualWorkers - setWorkers;
    const isOverstaffed = overstaffedCount > 0;
    const isUnderstaffed = overstaffedCount < 0;

    const actualCost = stats.totalActualCost || 0;
    const estCost = stats.totalEstCost || 0;
    const isOverBudget = actualCost > estCost;
    const costDiff = Math.abs(actualCost - estCost);
    
    const actualCostStr = `₱${actualCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const estCostStr = `₱${estCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const costDiffStr = `₱${costDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 1. Output Analysis
    if (productivityPercentage >= 100) {
        keyFindings.push({ icon: CheckCircle2, text: `Exceeding production targets by ${(productivityPercentage - 100).toFixed(1)}%.`, type: "positive" });
    } else if (productivityPercentage >= 85) {
        keyFindings.push({ icon: Activity, text: `Slightly missing targets. Current output is at ${productivityPercentage.toFixed(1)}% of target.`, type: "neutral" });
    } else {
        keyFindings.push({ icon: AlertTriangle, text: `Significantly underperforming. Missing ${(100 - productivityPercentage).toFixed(1)}% of target output.`, type: "negative" });
    }

    // 2. Staffing Analysis
    if (isOverstaffed) {
        keyFindings.push({ icon: Users, text: `Overstaffed by ${overstaffedCount} workers compared to the scheduled headcount.`, type: "negative" });
        recommendations.push("Enforce strict RFID tap-in policies to prevent unscheduled workers from clocking in.");
        recommendations.push("Review line leader scheduling to ensure accurate manpower requests.");
    } else if (isUnderstaffed) {
        keyFindings.push({ icon: Users, text: `Understaffed by ${Math.abs(overstaffedCount)} workers.`, type: "negative" });
        recommendations.push("Address absenteeism immediately. Contact missing workers or arrange for relievers.");
        recommendations.push("Investigate if the target produce can be lowered or if workers from other lines can be reallocated.");
    } else {
        keyFindings.push({ icon: Users, text: "Operating exactly at the scheduled headcount.", type: "positive" });
    }

    // 3. Cost Analysis
    if (isOverBudget) {
        keyFindings.push({ icon: DollarSign, text: `Labor costs are over budget by ${costDiffStr}.`, type: "negative" });
        if (productivityPercentage < 100) {
            recommendations.push("Halt non-essential overtime as production targets are not being met despite higher costs.");
        }
    } else if (actualCost > 0 && estCost > 0) {
        keyFindings.push({ icon: DollarSign, text: `Labor costs are within budget (Saved ${costDiffStr}).`, type: "positive" });
    }

    // Overall Status & Summary Logic
    if (productivityPercentage >= 100 && !isOverstaffed && !isOverBudget) {
        overallStatus = "excellent";
        title = "Highly Optimized & Profitable";
        summary = "The production line is running perfectly. Targets are being exceeded while maintaining strict adherence to the labor budget and scheduled headcount.";
        recommendations.push("Acknowledge the line leader and workers for exceptional performance.");
        recommendations.push("Consider documenting the current line setup as a standard best practice.");
    } else if (productivityPercentage >= 90 && (!isOverstaffed || !isOverBudget)) {
        overallStatus = "warning";
        title = "Acceptable Performance with Minor Inefficiencies";
        summary = "The line is performing near expectations, but there are slight inefficiencies in either output, staffing, or cost that need minor adjustments.";
        if (recommendations.length === 0) {
            recommendations.push("Monitor the line closely for the next few hours to prevent further drops in productivity.");
        }
    } else if (productivityPercentage < 80 && isOverstaffed) {
         overallStatus = "critical";
         title = "Critical Alert: Severe Profitability Risk";
         summary = `Operations are highly unprofitable. Production is extremely low (${productivityPercentage.toFixed(1)}%) while paying for extra unscheduled workers.`;
         recommendations.unshift("URGENT: Halt operations temporarily to audit the floor. Remove unassigned workers.");
    } else {
         overallStatus = "critical";
         title = "Action Required: Underperforming Line";
         summary = "The line is failing to meet key performance indicators. Immediate intervention is required to correct staffing or identify production blockers.";
         if (recommendations.length === 0) {
            recommendations.push("Investigate potential machine downtime or material shortages that might be blocking production.");
         }
    }

    const config = {
        excellent: {
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-600/10",
            border: "border-emerald-200",
            gradient: "from-emerald-500/5 to-transparent",
            badge: "bg-emerald-100 text-emerald-800"
        },
        warning: {
            icon: AlertTriangle,
            color: "text-amber-600",
            bg: "bg-amber-600/10",
            border: "border-amber-200",
            gradient: "from-amber-500/5 to-transparent",
            badge: "bg-amber-100 text-amber-800"
        },
        critical: {
            icon: TrendingDown,
            color: "text-rose-600",
            bg: "bg-rose-600/10",
            border: "border-rose-200",
            gradient: "from-rose-500/5 to-transparent",
            badge: "bg-rose-100 text-rose-800"
        }
    };

    const activeConfig = config[overallStatus];
    const Icon = activeConfig.icon;

    return (
        <div className={`rounded-xl border ${activeConfig.border} bg-gradient-to-br ${activeConfig.gradient} p-6 shadow-sm flex flex-col`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center p-2 rounded-lg bg-indigo-600/10">
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-indigo-950">Advanced AI Analysis</h3>
                        <p className="text-xs text-muted-foreground font-medium">Powered by VOS Analytics</p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${activeConfig.badge}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {overallStatus}
                </div>
            </div>
            
            {/* Summary */}
            <div className="mb-6">
                <h4 className={`text-lg font-bold mb-2 ${activeConfig.color}`}>{title}</h4>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    {summary}
                </p>
            </div>

            {/* Two Column Layout for Findings and Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-auto">
                {/* Key Findings */}
                <div className="space-y-3">
                    <h5 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Activity className="h-4 w-4 text-indigo-500" />
                        Key Findings
                    </h5>
                    <div className="space-y-2">
                        {keyFindings.map((finding, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-background/50 border shadow-sm">
                                <finding.icon className={`h-4 w-4 shrink-0 mt-0.5 ${
                                    finding.type === 'positive' ? 'text-emerald-500' : 
                                    finding.type === 'negative' ? 'text-rose-500' : 'text-amber-500'
                                }`} />
                                <span className="text-sm font-medium text-foreground">{finding.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-3">
                    <h5 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        AI Recommendations
                    </h5>
                    <div className="space-y-2">
                        {recommendations.map((rec, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100 shadow-sm dark:bg-indigo-950/20 dark:border-indigo-900/50">
                                <div className="h-5 w-5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs mt-0.5">
                                    {idx + 1}
                                </div>
                                <span className="text-sm font-medium text-foreground">{rec}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
