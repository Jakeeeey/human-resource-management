"use client";

import { useState } from "react";
import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Eye, FileText } from "lucide-react";

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
    setSelectedRequest: (request: OpenRequestRow | null) => void;
    setIsDetailOpen: (isOpen: boolean) => void;
}

export function OpenManpowerRequestsList() {
    const context = useManpowerRecommendation() as ReturnType<typeof useManpowerRecommendation> & OpenRequestsListT1Contract;
    const { recommendations, openRequests, isLoading, error, setSelectedRequest, setIsDetailOpen } = context;
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const requestRecs = (requestId: number) =>
        recommendations.filter((r) => r.manpower_request_id === requestId);
    const recommendedCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => r.status === "Recommended").length;
    const approvedCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => r.status === "Approved" || r.status === "Hired").length;
    const hiredCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => r.status === "Hired").length;
    const getDisplayStatus = (req: OpenRequestRow) => {
        const total = (req.no_manpower_needed ?? 0);
        if (total > 0 && hiredCount(req.id) >= total) return "Closed";
        if (total > 0 && approvedCount(req.id) >= total) return "Full";
        return req.status;
    };

    const query = search.trim().toLowerCase();
    const filteredRequests = openRequests.filter((req) => {
        if (query && !`${req.request_no} ${req.position}`.toLowerCase().includes(query)) return false;
        if (statusFilter !== "All" && getDisplayStatus(req) !== statusFilter) return false;
        return true;
    });

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
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-36 truncate" aria-label="Filter by status">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All statuses</SelectItem>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Full">Full</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-border/50">
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request No</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Position</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Recommended</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Approved</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Status</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium animate-pulse">Loading open requests...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredRequests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="font-medium">No open manpower requests.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredRequests.map((req) => {
                                const recommended = recommendedCount(req.id);
                                const approved = approvedCount(req.id);
                                const hired = hiredCount(req.id);
                                const total = (req.no_manpower_needed ?? 0);
                                const isClosed = total > 0 && hired >= total;
                                const isFull = total > 0 && approved >= total && !isClosed;
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
                                        <TableCell className="font-medium text-muted-foreground/80 text-center">
                                            {recommended}
                                        </TableCell>
                                        <TableCell className="font-medium text-muted-foreground/80 text-center">
                                            {approved}/{total}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {isClosed ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 border-blue-500/20 inline-block w-[110px] text-center">
                                                    Closed
                                                </span>
                                            ) : isFull ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 border-amber-500/20 inline-block w-[110px] text-center">
                                                    Full
                                                </span>
                                            ) : req.status === "Approved" ? (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20 inline-block w-[110px] text-center">
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-600 border-zinc-500/20 inline-block w-[110px] text-center">
                                                    {req.status}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
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
