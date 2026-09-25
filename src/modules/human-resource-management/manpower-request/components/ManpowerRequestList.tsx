"use client";

import { useState } from "react";
import { useManpowerRequest } from "../hooks/useManpowerRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { FilterCombobox } from "@/modules/human-resource-management/employee-admin/manpower-approval/components/FilterCombobox";
import { requesterName } from "../utils/requester";

import { Plus, Search, FileText, MoreVertical, Eye, Pencil } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ManpowerRequestList() {
    const { requests: allRequests, departments, users, isLoading, error, setIsCreateOpen, setIsEditOpen, setSelectedRequest, searchQuery, setSearchQuery, handleView } = useManpowerRequest();

    const [pageIndex, setPageIndex] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const departmentName = (id: number | undefined) => departments.find(d => d.id === id)?.name || String(id ?? "");

    const departmentOptions = Array.from(new Set(allRequests.map(r => departmentName(r.requesting_department_id)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({ value: name, label: name }));

    const query = searchQuery.trim().toLowerCase();
    const requests = allRequests.filter(req => {
        const matchesDepartment = selectedDepartment === "all" || departmentName(req.requesting_department_id).toLowerCase() === selectedDepartment.toLowerCase();
        const matchesSearch = !query || [
            req.request_no,
            req.position,
            requesterName(req, users),
        ].some(value => value?.toLowerCase().includes(query));
        return matchesDepartment && matchesSearch;
    });

    const maxPageIndex = Math.max(0, Math.ceil(requests.length / pageSize) - 1);
    const safePageIndex = Math.min(pageIndex, maxPageIndex);
    const pagedRequests = requests.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);

    const getPurposeColor = (purpose: string) => {
        switch (purpose) {
            case 'New Position': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'Additional': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Replacement': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    const getStatus = (req: { status?: string }) => {
        return req.status || "Draft";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'Rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'Draft': return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20';
            default: return 'bg-primary/10 text-primary border-primary/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1">
                <div className="relative w-full sm:w-[400px] group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search by request no., position or requester..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 rounded-full bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 transition-all text-base"
                    />
                </div>
                <FilterCombobox
                    options={departmentOptions}
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    placeholder="Department"
                    emptyMessage="No department found."
                    allLabel="All Departments"
                />
                <Button
                    onClick={() => setIsCreateOpen(true)} 
                    className="w-full sm:w-auto h-12 px-8 rounded-full shadow-md hover:shadow-lg transition-all font-semibold tracking-wide"
                >
                    <Plus className="mr-2 h-5 w-5" /> 
                    Create Request
                </Button>
            </div>

            {/* Table Container */}
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-border/50">
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground pl-6 h-14">Request No</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Department</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Position Title</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Requested By</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Purpose</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">No of manpower needed</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Status</TableHead>
                            <TableHead className="w-[50px] pr-6 h-14"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium animate-pulse">Loading requests...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="font-medium">No manpower requests found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            pagedRequests.map((req) => (
                                <TableRow key={req.id} className="hover:bg-muted/40 transition-colors border-border/50 group">
                                    <TableCell className="pl-6 h-16">
                                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                                            {req.request_no}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground/80">
                                        {departments.find(d => d.id === req.requesting_department_id)?.name || req.requesting_department_id}
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground/80">
                                        {req.position}
                                    </TableCell>
                                    <TableCell className="font-medium text-muted-foreground/80">
                                        {requesterName(req, users)}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getPurposeColor(req.purpose)}`}>
                                            {req.purpose}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm text-foreground/80 border">
                                            {req.no_manpower_needed}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-3 py-1.5 border text-xs rounded-full font-bold uppercase tracking-wider ${getStatusColor(getStatus(req))}`}>
                                            {getStatus(req)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleView(req)} className="cursor-pointer">
                                                    <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                                                    View Details
                                                </DropdownMenuItem>
                                                {getStatus(req) === "Draft" && (
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedRequest(req);
                                                            setIsEditOpen(true);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4 text-muted-foreground" />
                                                        Edit / Revise
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                {requests.length > 0 && (
                    <div className="border-t border-border/50 p-3">
                        <DataTablePagination
                            pageIndex={safePageIndex + 1}
                            pageSize={pageSize}
                            rowCount={requests.length}
                            onPageChange={(page) => setPageIndex(page - 1)}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPageIndex(0);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
