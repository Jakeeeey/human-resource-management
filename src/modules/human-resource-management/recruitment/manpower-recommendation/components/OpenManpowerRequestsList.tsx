"use client";

import { useState } from "react";
import { useManpowerRecommendation } from "../hooks/useManpowerRecommendation";
import { isApplicantHired, isApplicantSlotOccupying } from "../utils/applicantPipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Eye, FileText } from "lucide-react";

type OpenRequestRow = {
    id: number;
    request_no: string;
    division_id: number | null;
    position: string;
    no_manpower_needed: number;
    status: string;
};

type RequestView = {
    request: OpenRequestRow;
    division: string;
    recommended: number;
    approved: number;
    displayStatus: string;
};

const STATUS_PILL_TINTS: Record<string, string> = {
    Closed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    Full: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    Open: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
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

function RequestStatusPill({ status }: { status: string }) {
    const tint = STATUS_PILL_TINTS[status] ?? "bg-zinc-500/10 text-zinc-600 border-zinc-500/20";
    return (
        <span className={`inline-block w-[110px] rounded-full border px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider ${tint}`}>
            {status}
        </span>
    );
}

export function OpenManpowerRequestsList() {
    const context = useManpowerRecommendation() as ReturnType<typeof useManpowerRecommendation> & OpenRequestsListT1Contract;
    const { recommendations, applicants, openRequests, divisions, isLoading, error, setSelectedRequest, setIsDetailOpen } = context;
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const requestRecs = (requestId: number) =>
        recommendations.filter((r) => r.manpower_request_id === requestId);
    const applicantById = new Map(applicants.map((a) => [a.id, a]));
    // Pending recommendation ARTIFACTS (the rec lifecycle display, not a pipeline count).
    const recommendedCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => r.status === "Recommended").length;
    // Approved/hired counts (and the Closed/Full display status) follow the
    // APPLICANT pipeline (todo 8 reconciliation): `applicant.status` is the
    // truth; the rec row only links request->applicant. A rejected/withdrawn
    // applicant frees its slot even when the rec row still reads Approved.
    const approvedCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => isApplicantSlotOccupying(applicantById.get(r.applicant_id)?.status)).length;
    const hiredCount = (requestId: number) =>
        requestRecs(requestId).filter((r) => isApplicantHired(applicantById.get(r.applicant_id)?.status)).length;
    const divisionName = (req: OpenRequestRow) =>
        req.division_id == null ? "N/A" : (divisions.find((d) => d.id === req.division_id)?.name ?? String(req.division_id));

    const toView = (request: OpenRequestRow): RequestView => {
        const total = request.no_manpower_needed ?? 0;
        const approved = approvedCount(request.id);
        const hired = hiredCount(request.id);
        const displayStatus = total > 0 && hired >= total ? "Closed" : total > 0 && approved >= total ? "Full" : request.status === "Approved" ? "Open" : request.status;
        return { request, division: divisionName(request), recommended: recommendedCount(request.id), approved, displayStatus };
    };

    const query = search.trim().toLowerCase();
    const views = openRequests.map(toView).filter(({ request, displayStatus }) => {
        if (query && !`${request.request_no} ${request.position}`.toLowerCase().includes(query)) return false;
        if (statusFilter !== "All" && displayStatus !== statusFilter) return false;
        return true;
    });

    const filtersActive = query !== "" || statusFilter !== "All";
    const clearFilters = () => {
        setSearch("");
        setStatusFilter("All");
    };
    const statusFilterLabel = statusFilter === "Approved" ? "open" : statusFilter.toLowerCase();
    const emptyMessage = (): string => {
        const raw = search.trim();
        if (raw && statusFilter !== "All") return `No requests match “${raw}” with ${statusFilterLabel} status.`;
        if (raw) return `No requests match “${raw}”.`;
        if (statusFilter !== "All") return `No ${statusFilterLabel} requests.`;
        return "No open manpower requests.";
    };
    const openDetail = (request: OpenRequestRow) => {
        setSelectedRequest(request);
        setIsDetailOpen(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 px-2.5 py-0.5 text-xs font-bold">
                        {views.length}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                        {views.length === 1 ? "request" : "requests"}
                    </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Input
                        placeholder="Search request no or position..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:w-64"
                    />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-36 truncate" aria-label="Filter by status">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All statuses</SelectItem>
                            <SelectItem value="Approved">Open</SelectItem>
                            <SelectItem value="Full">Full</SelectItem>
                            <SelectItem value="Closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center text-muted-foreground h-48">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                        <p className="font-medium animate-pulse">Loading open requests...</p>
                    </div>
                ) : views.length === 0 ? (
                    <div className="flex items-center justify-center h-48 px-4">
                        <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                            <FileText className="w-12 h-12 text-muted-foreground/30" />
                            <p className="font-medium">{emptyMessage()}</p>
                            {filtersActive && (
                                <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto sm:block">
                            <Table className="min-w-[760px]">
                                <TableHeader className="bg-muted/30">
                                    <TableRow className="hover:bg-transparent border-border/50">
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request No</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Division</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Position</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center" title="Open recommendation artifacts not yet decided">Recommended</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center" title="Applicants whose pipeline status commits a slot (Final Approved → Hired)">Slots Filled</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-center">Status</TableHead>
                                        <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14 text-right pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {views.map(({ request, division, recommended, approved, displayStatus }) => (
                                        <TableRow key={request.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                            <TableCell className="pl-6 h-16">
                                                <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                                    {request.request_no}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-muted-foreground/80">
                                                {division}
                                            </TableCell>
                                            <TableCell className="font-medium text-muted-foreground/80">
                                                {request.position}
                                            </TableCell>
                                            <TableCell className="font-medium text-muted-foreground/80 text-center">
                                                {recommended}
                                            </TableCell>
                                            <TableCell className="font-medium text-muted-foreground/80 text-center">
                                                {approved}/{request.no_manpower_needed ?? 0}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <RequestStatusPill status={displayStatus} />
                                            </TableCell>
                                            <TableCell className="pr-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => openDetail(request)} aria-label={`View details for request ${request.request_no}`}>
                                                        <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        Details
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {/* Mobile: stacked cards keep Status + Details (the only path to detail/recommend) reachable */}
                        <div className="sm:hidden divide-y divide-border/50">
                            {views.map(({ request, division, recommended, approved, displayStatus }) => (
                                <div key={request.id} className="space-y-3 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground truncate" title={request.request_no}>{request.request_no}</p>
                                            <p className="text-sm text-muted-foreground truncate" title={request.position}>{request.position}</p>
                                            <p className="text-xs text-muted-foreground truncate" title={division}>{division}</p>
                                        </div>
                                        <RequestStatusPill status={displayStatus} />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <span>Recommended: <span className="font-semibold text-foreground">{recommended}</span></span>
                                        <span>Slots filled: <span className="font-semibold text-foreground">{approved}/{request.no_manpower_needed ?? 0}</span></span>
                                    </div>
                                    <Button variant="outline" size="sm" className="w-full" onClick={() => openDetail(request)} aria-label={`View details for request ${request.request_no}`}>
                                        <Eye className="mr-1.5 h-4 w-4" />
                                        Details
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
