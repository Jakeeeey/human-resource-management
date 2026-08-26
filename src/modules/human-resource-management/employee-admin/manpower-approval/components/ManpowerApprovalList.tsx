"use client";

import { useManpowerApproval } from "../hooks/useManpowerApproval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Eye, Check, X } from "lucide-react";
import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilterCombobox } from "./FilterCombobox";

export function ManpowerApprovalList() {
    const { requests, departments, isLoading, error, setSelectedRequest, setIsViewOpen, approveRequest, rejectRequest } = useManpowerApproval();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
    const [selectedPurpose, setSelectedPurpose] = useState<string>("all");
    const [confirmAction, setConfirmAction] = useState<{ type: 'Approve' | 'Reject', id: number } | null>(null);

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const filteredRequests = requests.filter(req => {
        const matchesSearch = !searchQuery || req.request_no?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const reqDeptName = departments.find(d => d.id === req.requesting_department_id)?.name || String(req.requesting_department_id);
        const matchesDepartment = selectedDepartment === "all" || reqDeptName.toLowerCase() === selectedDepartment.toLowerCase();
        
        const matchesPurpose = selectedPurpose === "all" || req.purpose.toLowerCase() === selectedPurpose.toLowerCase();

        return matchesSearch && matchesDepartment && matchesPurpose;
    });

    const getPurposeColor = (purpose: string) => {
        switch (purpose) {
            case 'New Position': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'Additional': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Replacement': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const handleConfirm = async () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'Approve') {
            await approveRequest(confirmAction.id);
        } else {
            await rejectRequest(confirmAction.id);
        }
        setConfirmAction(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1">
                <div className="relative w-full sm:w-[400px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search by Request No..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 rounded-full bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 transition-all text-base"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <FilterCombobox
                        options={departments.map(d => ({ value: d.name, label: d.name }))}
                        value={selectedDepartment}
                        onChange={setSelectedDepartment}
                        placeholder="Department"
                        emptyMessage="No department found."
                        allLabel="All Departments"
                    />
                    
                    <FilterCombobox
                        options={[
                            { value: "New Position", label: "New Position" },
                            { value: "Additional", label: "Additional" },
                            { value: "Replacement", label: "Replacement" }
                        ]}
                        value={selectedPurpose}
                        onChange={setSelectedPurpose}
                        placeholder="Purpose"
                        emptyMessage="No purpose found."
                        allLabel="All Purposes"
                    />
                </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-border/50">
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request No</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Department</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Position Title</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Purpose</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Manpower</TableHead>
                            <TableHead className="w-[180px] pr-6 h-14 text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium animate-pulse">Loading draft requests...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="font-medium">No draft requests pending approval.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map((req) => (
                                <TableRow key={req.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                    <TableCell className="pl-6 h-16 font-bold text-foreground group-hover:text-primary transition-colors">
                                        {req.request_no}
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground/80">
                                        {departments.find(d => d.id === req.requesting_department_id)?.name || req.requesting_department_id}
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground/80">
                                        {req.position}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getPurposeColor(req.purpose)}`}>
                                            {req.purpose}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm text-foreground/80 border mx-auto">
                                            {req.no_manpower_needed}
                                        </div>
                                    </TableCell>
                                    <TableCell className="pr-6 text-center">
                                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                                onClick={() => {
                                                    setSelectedRequest(req);
                                                    setIsViewOpen(true);
                                                }}
                                                title="View Details"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 rounded-full"
                                                onClick={() => setConfirmAction({ type: 'Approve', id: req.id! })}
                                                title="Approve"
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                                                onClick={() => setConfirmAction({ type: 'Reject', id: req.id! })}
                                                title="Reject"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will {confirmAction?.type.toLowerCase()} this manpower request. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handleConfirm}
                            className={confirmAction?.type === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}
                        >
                            {confirmAction?.type}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
