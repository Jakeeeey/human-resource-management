/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { DispatchAttendance } from "../type";
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

import { SearchableSelect } from "@/components/ui/searchable-select";
import { PlusCircle, Trash2 } from "lucide-react";

interface EditDispatchStaffDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    dispatchRecord: DispatchAttendance | null;
    onSave: (payload: { dispatchPlanId: number; isExtra?: boolean; driverId: number | null; helperIds: number[]; timeOfDispatch?: string | null; vehicleId?: number | null; area?: string; }) => Promise<{ success: boolean; } | void>;
}

interface UserOption {
    id: number;
    name: string;
    position: string;
}

export function EditDispatchStaffDialog({
    isOpen,
    onOpenChange,
    dispatchRecord,
    onSave,
}: EditDispatchStaffDialogProps) {
    const [users, setUsers] = useState<UserOption[]>([]);
    const [vehicles, setVehicles] = useState<{id: number, plate: string, type: string}[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

    const [driverId, setDriverId] = useState<string>("none");
    const [helperIds, setHelperIds] = useState<string[]>([]);
    const [timeOfDispatch, setTimeOfDispatch] = useState<string>("");
    const [vehicleId, setVehicleId] = useState<string>("none");
    const [area, setArea] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen && users.length === 0) {
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
        
        if (isOpen && vehicles.length === 0) {
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
    }, [isOpen, users.length, vehicles.length]);

    useEffect(() => {
        if (isOpen && dispatchRecord) {
            setDriverId(dispatchRecord.driverId ? String(dispatchRecord.driverId) : "none");
            setVehicleId(dispatchRecord.vehicleId ? String(dispatchRecord.vehicleId) : "none");
            const currentHelperIds = dispatchRecord.staff
                .map(s => s.staffUserId)
                .filter((id): id is number => id !== null);
            setHelperIds(currentHelperIds.map(id => String(id)));
            
            setArea(dispatchRecord.isExtra && dispatchRecord.areaName !== "N/A" ? (dispatchRecord.areaName || "") : "");
            
            if (dispatchRecord.timeOfDispatch) {
                // Convert UTC to local datetime-local format YYYY-MM-DDTHH:mm
                const dateObj = new Date(dispatchRecord.timeOfDispatch);
                const tzOffset = (new Date()).getTimezoneOffset() * 60000; 
                const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                setTimeOfDispatch(localISOTime);
            } else {
                setTimeOfDispatch("");
            }
        }
    }, [isOpen, dispatchRecord]);

    if (!dispatchRecord) return null;

    const handleSave = async () => {
        if (!dispatchRecord.dispatchPlanId) return;

        setIsSaving(true);
        try {
            const parsedDriverId = driverId !== "none" ? parseInt(driverId, 10) : null;
            const parsedVehicleId = vehicleId !== "none" ? parseInt(vehicleId, 10) : null;
            const parsedHelperIds = helperIds
                .filter(id => id !== "none")
                .map(id => parseInt(id, 10));

            // Convert local time back to UTC ISO for saving
            let finalTime = null;
            if (timeOfDispatch) {
                const dateObj = new Date(timeOfDispatch);
                finalTime = dateObj.toISOString();
            }

            await onSave({
                dispatchPlanId: dispatchRecord.dispatchPlanId,
                isExtra: dispatchRecord.isExtra,
                driverId: parsedDriverId,
                helperIds: parsedHelperIds,
                timeOfDispatch: finalTime,
                vehicleId: parsedVehicleId,
                area: dispatchRecord.isExtra ? (area.trim() || undefined) : undefined,
            });
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save", error);
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

    const vehicleOptions = [
        { value: "none", label: "No Vehicle Assigned" },
        ...vehicles.map(v => ({
            value: String(v.id),
            label: `${v.plate || "No Plate"} (${v.type})`
        }))
    ];

    const driverOptions = [
        { value: "none", label: "No Driver Assigned" },
        ...users.map(u => ({
            value: String(u.id),
            label: `${u.name} (${u.position})`
        }))
    ];

    const helperOptions = [
        { value: "none", label: "Select Helper..." },
        ...users.map(u => ({
            value: String(u.id),
            label: `${u.name} (${u.position})`
        }))
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit PDP Staff & Info</DialogTitle>
                    <DialogDescription>
                        Update the Driver, Helpers, Time, and Vehicle for {dispatchRecord.dispatchDocNo || `PDP-${dispatchRecord.dispatchPlanId}`}.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    {/* Time of Dispatch */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="timeOfDispatch" className="font-semibold text-slate-700">Time of Dispatch</Label>
                        <Input
                            id="timeOfDispatch"
                            type="datetime-local"
                            value={timeOfDispatch}
                            onChange={(e) => setTimeOfDispatch(e.target.value)}
                        />
                    </div>
                    
                    {/* Area (Only show if it's an Extra PDP) */}
                    {dispatchRecord.isExtra && (
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="area" className="font-semibold text-slate-700">Area</Label>
                            <Input
                                id="area"
                                placeholder="e.g. Metro Manila"
                                value={area}
                                onChange={(e) => setArea(e.target.value)}
                            />
                        </div>
                    )}
                    
                    {/* Vehicle Selection */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="vehicleId" className="font-semibold text-slate-700">Vehicle</Label>
                        <SearchableSelect 
                            options={vehicleOptions}
                            value={vehicleId}
                            onValueChange={setVehicleId}
                            disabled={isLoadingVehicles}
                            placeholder={isLoadingVehicles ? "Loading vehicles..." : "Select Vehicle"}
                        />
                    </div>

                    {/* Driver Selection */}
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="driverId" className="font-semibold text-slate-700">Driver</Label>
                        <SearchableSelect 
                            options={driverOptions}
                            value={driverId}
                            onValueChange={setDriverId}
                            disabled={isLoadingUsers}
                            placeholder={isLoadingUsers ? "Loading users..." : "Select Driver"}
                        />
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
                                        <SearchableSelect 
                                            className="flex-1"
                                            options={helperOptions}
                                            value={hId}
                                            onValueChange={(val) => updateHelper(index, val)}
                                            disabled={isLoadingUsers}
                                            placeholder="Select Helper"
                                        />
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
                        {isSaving ? "Saving..." : "Save changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
