"use client";

import React, { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PackageSearch, CheckCircle2, AlertCircle } from "lucide-react";
import { StaffPayrollSummary, DispatchDetail } from "../types/logistics-payroll.schema";

export function LogisticsPayrollTable() {
    const { data, isLoading, error, approvePayroll } = useLogisticsPayrollContext();
    const [selectedStaff, setSelectedStaff] = useState<StaffPayrollSummary | null>(null);
    const [dispatchAmounts, setDispatchAmounts] = useState<Record<number, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Sync selectedStaff with data changes (e.g. after approval refresh)
    useEffect(() => {
        if (selectedStaff) {
            const updatedStaff = data.find(s => s.staffId === selectedStaff.staffId);
            if (updatedStaff) {
                setSelectedStaff(updatedStaff);
                // Also sync amounts for any newly approved items or if data changed
                setDispatchAmounts(prev => {
                    const newAmounts = { ...prev };
                    updatedStaff.dispatches.forEach(dp => {
                        if (dp.isApproved) {
                            newAmounts[dp.dispatchPlanId] = String(dp.approvedAmount);
                        }
                    });
                    return newAmounts;
                });
            } else {
                setSelectedStaff(null);
            }
        }
    }, [data, selectedStaff?.staffId]);

    const openModal = (staff: StaffPayrollSummary) => {
        setSelectedStaff(staff);
        const initialAmounts: Record<number, string> = {};
        staff.dispatches.forEach(dp => {
            initialAmounts[dp.dispatchPlanId] = dp.approvedAmount !== undefined ? String(dp.approvedAmount) : String(dp.amount);
        });
        setDispatchAmounts(initialAmounts);
        setSubmitError(null);
    };

    const handleApproveDispatch = async (dp: DispatchDetail) => {
        if (!selectedStaff) return;
        setSubmitError(null);
        setIsSubmitting(true);
        try {
            const amt = Number(dispatchAmounts[dp.dispatchPlanId]);
            const areas = dp.location ? Array.from(new Set(Array.from(dp.location.matchAll(/\(([^)]+)\)/g)).map(m => m[1]))) : [];
            const areaName = areas.length > 0 ? areas.join(', ') : undefined;
            await approvePayroll(selectedStaff.staffId, amt, dp.dispatchDocNo, dp.role, areaName, dp.timeOfDispatch || undefined);
            // After successful approval, `data` will refresh via hook and `useEffect` will update `selectedStaff`
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : "Failed to approve payroll for dispatch");
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
        <div className="rounded-md border bg-white shadow-sm overflow-auto max-h-[700px]">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="font-semibold text-slate-700">Staff ID</TableHead>
                        <TableHead className="font-semibold text-slate-700">Name</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Total Dispatches</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-right">Total Calculated Amount</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                Loading logistics payroll data...
                            </TableCell>
                        </TableRow>
                    ) : data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                <div className="flex flex-col items-center justify-center gap-2">
                                    <PackageSearch className="h-8 w-8 text-slate-300" />
                                    <span>No records found for this period.</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((row) => {
                            const isFullyApproved = row.dispatches.length > 0 && row.dispatches.every(dp => dp.isApproved);
                            
                            // Calculate display total (using approved amounts where applicable, else calculated amounts)
                            const displayTotal = row.dispatches.reduce((acc, dp) => acc + (dp.isApproved && dp.approvedAmount !== undefined ? dp.approvedAmount : dp.amount), 0);

                            return (
                                <TableRow 
                                    key={row.staffId}
                                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    onClick={() => openModal(row)}
                                >
                                    <TableCell className="font-medium text-slate-900">{row.staffId}</TableCell>
                                    <TableCell className="text-slate-900 font-medium">{row.staffName}</TableCell>
                                    <TableCell className="text-slate-600 text-right">{row.dispatches.length}</TableCell>
                                    <TableCell className="font-bold text-slate-700 text-right text-base">
                                        ₱{Number(displayTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {isFullyApproved ? (
                                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Fully Approved
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                                Pending Dispatches
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>

            <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
                {selectedStaff && (
                    <DialogContent className="sm:max-w-[1200px] w-[90vw] max-w-[95vw] max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Approve Payroll: {selectedStaff.staffName}</DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto pr-2 my-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Dispatch History</h4>
                            
                            {submitError && (
                                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded text-sm mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{submitError}</span>
                                </div>
                            )}

                            <div className="rounded-md border bg-white overflow-hidden shadow-sm mb-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-100/50">
                                            <TableHead className="text-xs min-w-[150px] max-w-[200px]">PDP No</TableHead>
                                            <TableHead className="text-xs">Role</TableHead>
                                            <TableHead className="text-xs min-w-[200px] max-w-[300px]">Location</TableHead>
                                            <TableHead className="text-xs min-w-[100px] max-w-[150px]">Area</TableHead>
                                            <TableHead className="text-xs min-w-[120px] max-w-[200px]">Vehicle</TableHead>
                                            <TableHead className="text-xs min-w-[100px]">Date of Dispatch</TableHead>
                                            <TableHead className="text-xs text-right">Calculated Rate</TableHead>
                                            <TableHead className="text-xs text-right w-40">Approved Amount</TableHead>
                                            <TableHead className="text-xs text-center w-32">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedStaff.dispatches.length > 0 ? (
                                            selectedStaff.dispatches.map((dp, idx) => (
                                                <TableRow key={idx} className="align-top">
                                                    <TableCell className="text-sm font-medium align-top">
                                                        <div className="min-w-[150px] max-w-[200px] whitespace-pre-wrap break-words">
                                                            {dp.dispatchDocNo}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600 align-top">{dp.role}</TableCell>
                                                    <TableCell className="text-sm text-slate-600 align-top">
                                                        <div className="min-w-[200px] max-w-[300px] whitespace-pre-wrap break-words" title={dp.location ? dp.location.replace(/\s*\([^)]+\)/g, '').trim() : "-"}>
                                                            {dp.location ? dp.location.replace(/\s*\([^)]+\)/g, '').trim() : "-"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600 align-top">
                                                        <div className="min-w-[100px] max-w-[150px] whitespace-pre-wrap break-words">
                                                            {dp.location && dp.location.match(/\(([^)]+)\)/) ? Array.from(new Set(Array.from(dp.location.matchAll(/\(([^)]+)\)/g)).map(m => m[1]))).join('\n') : "-"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600 align-top">
                                                        <div className="min-w-[120px] max-w-[200px] break-words whitespace-pre-wrap">
                                                            {dp.vehiclePlate ? `${dp.vehiclePlate} ${dp.vehicleType ? `(${dp.vehicleType})` : ''}` : '-'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-slate-600 align-top">
                                                        <div className="min-w-[100px]">
                                                            {dp.timeOfDispatch ? new Date(dp.timeOfDispatch).toLocaleDateString() : "-"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-right text-slate-500 align-top">
                                                        ₱{Number(dp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right align-top">
                                                        <Input 
                                                            type="number"
                                                            step="0.01"
                                                            className="text-right font-medium h-8 w-32 ml-auto"
                                                            value={dispatchAmounts[dp.dispatchPlanId] || ""}
                                                            onChange={(e) => setDispatchAmounts(prev => ({...prev, [dp.dispatchPlanId]: e.target.value}))}
                                                            disabled={dp.isApproved || isSubmitting}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center align-top">
                                                        {dp.isApproved ? (
                                                            <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 mt-1">
                                                                Approved
                                                            </Badge>
                                                        ) : (
                                                            <Button 
                                                                size="sm" 
                                                                onClick={() => handleApproveDispatch(dp)} 
                                                                disabled={isSubmitting || !dispatchAmounts[dp.dispatchPlanId]}
                                                                className="bg-green-600 hover:bg-green-700 text-white h-8"
                                                            >
                                                                Approve
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={9} className="text-center text-sm text-slate-500 py-4">
                                                    No dispatches assigned.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        <DialogFooter className="pt-2 border-t">
                            <Button variant="outline" onClick={() => setSelectedStaff(null)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
