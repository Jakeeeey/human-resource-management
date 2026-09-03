"use client";

import { useState } from "react";
import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Eye, FileText, Plus } from "lucide-react";

type OpenRequestRow = {
    id: number;
    request_no: string;
    position: string;
    no_manpower_needed: number;
    status: string;
};

/**
 * T1 provider contract (pendingRequestId + openRecommendForm + detail-dialog
 * state land in providers/ManpowerRecommendationProvider.tsx via T1; F1 resolves).
 * Coded against the plan contract — intersection cast keeps this file compiling pre-T1.
 */
interface OpenRequestsListT1Contract {
    setPendingRequestId: (id: number | null) => void;
    openRecommendForm: (requestId: number) => void;
    setSelectedRequest: (request: OpenRequestRow | null) => void;
    setIsDetailOpen: (isOpen: boolean) => void;
}

export function OpenManpowerRequestsList() {
    const context = useManpowerRecommendation() as ReturnType<typeof useManpowerRecommendation> & OpenRequestsListT1Contract;
    const { recommendations, openRequests, isLoading, error, setIsCreateOpen, setPendingRequestId, openRecommendForm, setSelectedRequest, setIsDetailOpen } = context;
    const [search, setSearch] = useState("");

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const query = search.trim().toLowerCase();
    const filteredRequests = query
        ? openRequests.filter((req) => `${req.request_no} ${req.position}`.toLowerCase().includes(query))
        : openRequests;

    const filledSlots = (requestId: number) =>
        recommendations.filter((r) => r.manpower_request_id === requestId).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">Open Manpower Requests</h2>
                    <span className="rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                        {filteredRequests.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search request no or position..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-64"
                    />
                    <Button size="sm" onClick={() => { setPendingRequestId(null); setIsCreateOpen(true); }} aria-label="New recommendation">
                        <Plus className="mr-2 h-4 w-4" />
                        New
                    </Button>
                </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-border/50">
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request No</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Position</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Slots</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium animate-pulse">Loading open requests...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="font-medium">No open manpower requests.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map((req) => {
                                const filled = filledSlots(req.id);
                                const total = (req.no_manpower_needed ?? 0);
                                return (
                                    <TableRow key={req.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                        <TableCell className="pl-6 h-16">
                                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                {req.request_no}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80">
                                            {req.position}
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80">
                                            {filled}/{total}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {req.status === "Approved" ? (
                                                    <Button size="sm" onClick={() => openRecommendForm(req.id)} aria-label={`Recommend for request ${req.request_no}`}>
                                                        Recommend
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Pending approval</span>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => { setSelectedRequest(req); setIsDetailOpen(true); }} aria-label={`View details for request ${req.request_no}`}>
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    Details
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
