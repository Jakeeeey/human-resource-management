"use client";

import React, { useState, useMemo } from "react";
import { useLogisticsPayrollContext } from "../providers/LogisticsPayrollProvider";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, CheckCircle2, PackageSearch, Save } from "lucide-react";
import { DispatchDetail } from "../types/logistics-payroll.schema";

interface StaffDispatchDetail extends DispatchDetail {
    staffId: number;
    staffName: string;
}

interface GroupedDispatchPlan {
    dispatchPlanId: number;
    dispatchDocNo: string;
    location: string;
    vehiclePlate?: string;
    vehicleType?: string;
    staffList: StaffDispatchDetail[];
    totalAmount: number;
    isFullyApproved: boolean;
    linkedDispatchNos?: string;
}

interface GroupedDate {
    dateStr: string;
    dateValue: number;
    dispatchPlans: GroupedDispatchPlan[];
    totalAmount: number;
    isFullyApproved: boolean;
}

export function DailyDispatchPayrollTable() {
    const { data, isLoading, error, searchQuery, approvePayroll, showPendingOnly } = useLogisticsPayrollContext();
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [amounts, setAmounts] = useState<Record<string, string>>({}); // Key: "staffId-dpId"
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPdpForModal, setSelectedPdpForModal] = useState<{ pdpNo: string, dps: string, location: string } | null>(null);
    const [selectedPlanForModal, setSelectedPlanForModal] = useState<GroupedDispatchPlan | null>(null);

    // Grouping logic
    const groupedData = useMemo(() => {
        const plansMap = new Map<number, GroupedDispatchPlan>();
        
        data.forEach(staff => {
            staff.dispatches.forEach(dp => {
                if (dp.isDisregarded) return; // Hide disregarded in this view
                
                if (!plansMap.has(dp.dispatchPlanId)) {
                    plansMap.set(dp.dispatchPlanId, {
                        dispatchPlanId: dp.dispatchPlanId,
                        dispatchDocNo: dp.dispatchDocNo,
                        location: dp.location,
                        vehiclePlate: dp.vehiclePlate,
                        vehicleType: dp.vehicleType,
                        staffList: [],
                        totalAmount: 0,
                        isFullyApproved: true,
                        linkedDispatchNos: dp.linkedDispatchNos
                    });
                }
                
                const plan = plansMap.get(dp.dispatchPlanId)!;
                plan.staffList.push({
                    ...dp,
                    staffId: staff.staffId,
                    staffName: staff.staffName
                });
                
                plan.totalAmount += (dp.isApproved && dp.approvedAmount !== undefined ? dp.approvedAmount : dp.amount);
                if (!dp.isApproved) plan.isFullyApproved = false;
            });
        });
        
        const datesMap = new Map<string, GroupedDate>();
        
        Array.from(plansMap.values()).forEach(plan => {
            const sampleTime = plan.staffList[0]?.timeOfDispatch;
            let dateStr = "Unknown Date";
            let dateValue = 0;
            
            if (sampleTime) {
                const d = new Date(sampleTime);
                dateValue = d.getTime();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const yyyy = d.getFullYear();
                dateStr = `${mm}/${dd}/${yyyy}`;
            }
            
            if (!datesMap.has(dateStr)) {
                datesMap.set(dateStr, {
                    dateStr,
                    dateValue,
                    dispatchPlans: [],
                    totalAmount: 0,
                    isFullyApproved: true
                });
            }
            
            const dateGroup = datesMap.get(dateStr)!;
            dateGroup.dispatchPlans.push(plan);
            dateGroup.totalAmount += plan.totalAmount;
            if (!plan.isFullyApproved) dateGroup.isFullyApproved = false;
        });
        
        const sortedDates = Array.from(datesMap.values()).sort((a, b) => b.dateValue - a.dateValue);
        
        let filteredDates = sortedDates;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredDates = filteredDates.map(d => {
                const filteredPlans = d.dispatchPlans.filter(p => 
                    p.dispatchDocNo.toLowerCase().includes(q) || 
                    (p.location || "").toLowerCase().includes(q) ||
                    p.staffList.some(s => s.staffName.toLowerCase().includes(q))
                );
                return { ...d, dispatchPlans: filteredPlans };
            }).filter(d => d.dispatchPlans.length > 0);
        }

        if (showPendingOnly) {
            filteredDates = filteredDates.map(d => {
                const filteredPlans = d.dispatchPlans.filter(p => !p.isFullyApproved);
                return { ...d, dispatchPlans: filteredPlans };
            }).filter(d => d.dispatchPlans.length > 0);
        }

        return filteredDates;
    }, [data, searchQuery, showPendingOnly]);

    // Pre-populate input amounts
    React.useEffect(() => {
        const newAmounts: Record<string, string> = {};
        groupedData.forEach(d => {
            d.dispatchPlans.forEach(p => {
                p.staffList.forEach(s => {
                    const key = `${s.staffId}-${s.dispatchPlanId}`;
                    newAmounts[key] = s.isApproved && s.approvedAmount !== undefined ? String(s.approvedAmount) : String(s.amount);
                });
            });
        });
        setAmounts(newAmounts);
    }, [groupedData]);

    const toggleDate = (dateStr: string) => {
        setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };


    const handleApprove = async (s: StaffDispatchDetail) => {
        setIsSubmitting(true);
        try {
            const key = `${s.staffId}-${s.dispatchPlanId}`;
            const amt = Number(amounts[key]);
            const areas = s.location ? Array.from(new Set(Array.from(s.location.matchAll(/\(([^)]+)\)/g)).map(m => m[1]))) : [];
            const areaName = areas.length > 0 ? areas.join(', ') : undefined;
            await approvePayroll(s.staffId, amt, s.dispatchDocNo, s.role, areaName, s.timeOfDispatch || undefined);
        } catch (err) {
            console.error("Approval failed", err);
            alert("Failed to approve: " + (err instanceof Error ? err.message : "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) {
        return (
            <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg">
                <p>Error loading payroll data: {error}</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-white shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="font-semibold text-slate-700">Date / Dispatch</TableHead>
                        <TableHead className="font-semibold text-slate-700">Details</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Total Amount</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Status</TableHead>
                        <TableHead className="w-24"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                Loading logistics payroll data...
                            </TableCell>
                        </TableRow>
                    ) : groupedData.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <PackageSearch className="h-8 w-8 text-slate-300" />
                                    <span>No records found for this period.</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        groupedData.map(dateGroup => (
                            <React.Fragment key={dateGroup.dateStr}>
                                {/* Date Row */}
                                <TableRow className="bg-slate-50 hover:bg-slate-100 cursor-pointer border-y-2 border-slate-200" onClick={() => toggleDate(dateGroup.dateStr)}>
                                    <TableCell>
                                        {expandedDates[dateGroup.dateStr] ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-900 text-base">
                                        {dateGroup.dateStr}
                                    </TableCell>
                                    <TableCell className="text-slate-600 text-sm">
                                        {dateGroup.dispatchPlans.length} Dispatches
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-800 text-right">
                                        ₱{dateGroup.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {dateGroup.isFullyApproved ? (
                                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                                Pending
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell></TableCell>
                                </TableRow>

                                {/* Dispatches under Date */}
                                {expandedDates[dateGroup.dateStr] && dateGroup.dispatchPlans.map(plan => (
                                    <React.Fragment key={plan.dispatchPlanId}>
                                        <TableRow className="bg-white hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedPlanForModal(plan)}>
                                            <TableCell className="pl-8">
                                                <ChevronRight className="w-4 h-4 text-slate-400" />
                                            </TableCell>
                                            <TableCell className="font-semibold text-slate-800">
                                                {plan.dispatchDocNo.split('\n').map((docNo, i) => (
                                                    <div 
                                                        key={i}
                                                        className={plan.linkedDispatchNos ? "hover:text-indigo-600 transition-colors inline-block" : ""}
                                                        onClick={(e) => {
                                                            if (plan.linkedDispatchNos) {
                                                                e.stopPropagation();
                                                                setSelectedPdpForModal({ pdpNo: plan.dispatchDocNo, dps: plan.linkedDispatchNos, location: plan.location });
                                                            }
                                                        }}
                                                        title={plan.linkedDispatchNos ? "Click to view linked DPs" : undefined}
                                                    >
                                                        {docNo}
                                                    </div>
                                                ))}
                                                {plan.linkedDispatchNos && (
                                                    <div className="mt-1">
                                                        <Badge 
                                                            variant="secondary" 
                                                            className="hover:bg-slate-200 text-[10px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPdpForModal({ pdpNo: plan.dispatchDocNo, dps: plan.linkedDispatchNos!, location: plan.location });
                                                            }}
                                                        >
                                                            {plan.linkedDispatchNos.split(',').length} Linked DP{plan.linkedDispatchNos.split(',').length !== 1 ? 's' : ''}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-slate-600 text-xs">
                                                <div className="max-w-[300px] truncate" title={plan.location}>
                                                    {plan.location ? plan.location.replace(/\s*\([^)]+\)/g, '').trim() : "No Location"}
                                                </div>
                                                <div className="text-slate-400 mt-1">
                                                    {plan.vehiclePlate || "No Plate"} {plan.vehicleType ? `(${plan.vehicleType})` : ''} • {plan.staffList.length} Staff
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-700 text-right">
                                                ₱{plan.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {plan.isFullyApproved ? (
                                                    <Badge variant="default" className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200 text-[10px] h-5">
                                                        Approved
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50 text-[10px] h-5">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))
                    )}
                </TableBody>
            </Table>

            <Dialog open={!!selectedPdpForModal} onOpenChange={(open) => !open && setSelectedPdpForModal(null)}>
                <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Linked Dispatch Plans</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-slate-500 mb-4">
                            The following Dispatch Plans (DP) are linked to <strong>{selectedPdpForModal?.pdpNo}</strong>:
                        </p>
                        <div className="max-h-[300px] overflow-y-auto pr-2">
                            <div className="flex flex-col gap-2">
                                {selectedPdpForModal?.dps.split(',').map((dp, idx) => (
                                    <div key={idx} className="bg-slate-50 border rounded p-3 text-sm font-medium text-slate-700 flex flex-col gap-1">
                                        <div>{dp.trim()}</div>
                                        {selectedPdpForModal.location && (
                                            <div className="text-xs text-slate-500 font-normal">
                                                {selectedPdpForModal.location.replace(/\s*\([^)]+\)/g, '').trim()}
                                                {selectedPdpForModal.location.match(/\(([^)]+)\)/) ? ` - ${selectedPdpForModal.location.match(/\(([^)]+)\)/)![1]}` : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPlanForModal} onOpenChange={(open) => !open && setSelectedPlanForModal(null)}>
                <DialogContent className="sm:max-w-[700px] w-[90vw] max-h-[90vh] overflow-y-auto flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Approve Staff for Dispatch</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="mb-4">
                            <h3 className="text-lg font-bold text-slate-800">
                                {selectedPlanForModal?.dispatchDocNo.split('\n').map((d, i) => <div key={i}>{d}</div>)}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedPlanForModal?.location}
                            </p>
                            {selectedPlanForModal?.linkedDispatchNos && (
                                <div className="mt-2 max-w-full overflow-x-auto">
                                    <p className="text-xs font-medium text-indigo-600 bg-indigo-50 p-2 rounded border border-indigo-100 inline-block whitespace-pre-wrap break-words min-w-full">
                                        Linked DP: {selectedPlanForModal.linkedDispatchNos}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="font-semibold text-slate-700">Name</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Role</TableHead>
                                        <TableHead className="font-semibold text-slate-700 text-right">Calculated Rate</TableHead>
                                        <TableHead className="font-semibold text-slate-700 text-right w-32">Approved Amount</TableHead>
                                        <TableHead className="font-semibold text-slate-700 text-center w-24">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedPlanForModal?.staffList.map(staff => (
                                        <TableRow key={`${staff.staffId}-${selectedPlanForModal.dispatchPlanId}`} className="hover:bg-slate-50/50">
                                            <TableCell className="text-sm font-medium text-slate-800">
                                                {staff.staffName}
                                            </TableCell>
                                            <TableCell className="text-sm text-slate-600">
                                                {staff.role}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="text-xs text-slate-400">
                                                    ₱{staff.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end">
                                                    <Input 
                                                        type="number"
                                                        step="0.01"
                                                        className="text-right font-medium h-8 w-full max-w-[120px] text-sm"
                                                        value={amounts[`${staff.staffId}-${selectedPlanForModal.dispatchPlanId}`] || ""}
                                                        onChange={(e) => setAmounts(prev => ({...prev, [`${staff.staffId}-${selectedPlanForModal.dispatchPlanId}`]: e.target.value}))}
                                                        disabled={staff.isApproved || isSubmitting}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {staff.isApproved ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-600 border-transparent text-[10px] h-6 w-full justify-center">
                                                        Done
                                                    </Badge>
                                                ) : (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleApprove(staff);
                                                        }} 
                                                        disabled={isSubmitting || !amounts[`${staff.staffId}-${selectedPlanForModal.dispatchPlanId}`]}
                                                        className="h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-xs w-full"
                                                    >
                                                        <Save className="w-3 h-3 mr-1" /> Save
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
