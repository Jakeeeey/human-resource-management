/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2 } from "lucide-react";

interface AddManualDispatchDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (payload: { docNo: string; timeOfDispatch: string; driverId: number | null; vehicleId: number | null; helperIds: number[]; }) => Promise<{ success: boolean; } | void>;
}

interface UserOption {
    id: number;
    name: string;
    position: string;
}

export function AddManualDispatchDialog({
    isOpen,
    onOpenChange,
    onSave,
}: AddManualDispatchDialogProps) {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [vehicles, setVehicles] = useState<{id: number, plate: string, type: string}[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

    const [docNo, setDocNo] = useState("");
    const [driverId, setDriverId] = useState<string>("none");
    const [helperIds, setHelperIds] = useState<string[]>([]);
    const [timeOfDispatch, setTimeOfDispatch] = useState<string>("");
    const [vehicleId, setVehicleId] = useState<string>("none");
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setDocNo("");
            setDriverId("none");
            setHelperIds([]);
            setTimeOfDispatch("");
            setVehicleId("none");
            setError(null);

            if (users.length === 0) {
                setIsLoadingUsers(true);
                fetch('/api/hrm/manage-logistics-attendance/users')
                    .then(res => res.json())
                    .then(data => {
                        if (data.data) {
                            setUsers(data.data.sort((a: any, b: any) => a.name.localeCompare(b.name)));
                        }
                    })
                    .finally(() => setIsLoadingUsers(false));
            }
            
            if (vehicles.length === 0) {
                setIsLoadingVehicles(true);
                fetch('/api/hrm/manage-logistics-attendance/vehicles')
                    .then(res => res.json())
                    .then(data => {
                        if (data.data) {
                            setVehicles(data.data);
                        }
                    })
                    .finally(() => setIsLoadingVehicles(false));
            }
        }
    }, [isOpen, users.length, vehicles.length]);

    const handleSave = async () => {
        if (!docNo) {
            setError("PDP Document Number is required.");
            return;
        }
        if (!timeOfDispatch) {
            setError("Time of Dispatch is required.");
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            const parsedDriverId = driverId !== "none" ? parseInt(driverId, 10) : null;
            const parsedVehicleId = vehicleId !== "none" ? parseInt(vehicleId, 10) : null;
            const parsedHelperIds = helperIds
                .filter(id => id !== "none")
                .map(id => parseInt(id, 10));

            // Convert local time back to UTC ISO for saving
            const dateObj = new Date(timeOfDispatch);
            const finalTime = dateObj.toISOString();

            await onSave({
                docNo,
                timeOfDispatch: finalTime,
                driverId: parsedDriverId,
                helperIds: parsedHelperIds,
                vehicleId: parsedVehicleId,
            });
            onOpenChange(false);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to save record.");
            console.error("Failed to save manual PDP", error);
        } finally {
            setIsSaving(false);
        }
    };

    const addHelper = () => {
        setHelperIds([...helperIds, "none"]);
    };

    const updateHelper = (index: number, val: string) => {
        const newHelpers = [...helperIds];
        newHelpers[index] = val;
        setHelperIds(newHelpers);
    };

    const removeHelper = (index: number) => {
        setHelperIds(helperIds.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Manual PDP</DialogTitle>
                    <DialogDescription>
                        Create a manual entry that will be stored in the extra dispatch records table.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-md border border-red-200 shadow-sm text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* PDP Document No */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="docNo" className="font-semibold text-slate-700">PDP No <span className="text-red-500">*</span></Label>
                        <Input
                            id="docNo"
                            placeholder="e.g. PDP-2026-0001"
                            value={docNo}
                            onChange={(e) => setDocNo(e.target.value)}
                        />
                    </div>

                    {/* Time of Dispatch */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="timeOfDispatch" className="font-semibold text-slate-700">Time of Dispatch <span className="text-red-500">*</span></Label>
                        <Input
                            id="timeOfDispatch"
                            type="datetime-local"
                            value={timeOfDispatch}
                            onChange={(e) => setTimeOfDispatch(e.target.value)}
                        />
                    </div>
                    
                    {/* Vehicle Selection */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="vehicleId" className="font-semibold text-slate-700">Vehicle</Label>
                        <Select value={vehicleId} onValueChange={setVehicleId} disabled={isLoadingVehicles}>
                            <SelectTrigger id="vehicleId">
                                <SelectValue placeholder={isLoadingVehicles ? "Loading vehicles..." : "Select Vehicle"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Vehicle Assigned</SelectItem>
                                {vehicles.map(v => (
                                    <SelectItem key={v.id} value={String(v.id)}>
                                        {v.plate || "No Plate"} <span className="text-muted-foreground text-xs ml-1">({v.type})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Driver Selection */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="driverId" className="font-semibold text-slate-700">Driver</Label>
                        <Select value={driverId} onValueChange={setDriverId} disabled={isLoadingUsers}>
                            <SelectTrigger id="driverId">
                                <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select Driver"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Driver Assigned</SelectItem>
                                {users.map(u => (
                                    <SelectItem key={u.id} value={String(u.id)}>
                                        {u.name} <span className="text-muted-foreground text-xs ml-1">({u.position})</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Helpers Selection */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <Label className="font-semibold text-slate-700">Helpers</Label>
                            <Button variant="outline" size="sm" onClick={addHelper} className="h-8 gap-1">
                                <PlusCircle className="h-4 w-4" /> Add Helper
                            </Button>
                        </div>
                        
                        {helperIds.length === 0 ? (
                            <div className="text-sm text-slate-500 italic py-2">No helpers assigned.</div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {helperIds.map((hId, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Select value={hId} onValueChange={(val) => updateHelper(index, val)} disabled={isLoadingUsers}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select Helper" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Select Helper...</SelectItem>
                                                {users.map(u => (
                                                    <SelectItem key={u.id} value={String(u.id)}>
                                                        {u.name} <span className="text-muted-foreground text-xs ml-1">({u.position})</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="ghost" size="icon" onClick={() => removeHelper(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isLoadingUsers}>
                        {isSaving ? "Saving..." : "Create PDP"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
