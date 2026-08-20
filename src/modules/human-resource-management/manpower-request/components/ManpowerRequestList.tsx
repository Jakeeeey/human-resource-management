"use client";

import { useManpowerRequest } from "../hooks/useManpowerRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Plus, Search, FileText, MoreVertical, Eye } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ManpowerRequestList() {
    const { requests, departments, isLoading, error, setIsCreateOpen, searchQuery, setSearchQuery, handleView } = useManpowerRequest();

    if (error) {
        return <div className="p-4 text-red-500 bg-red-50 rounded-lg">Error: {error}</div>;
    }

    const getPurposeColor = (purpose: string) => {
        switch (purpose) {
            case 'New Position': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
            case 'Additional': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'Replacement': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
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
                        placeholder="Search by Request No..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 rounded-full bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 transition-all text-base"
                    />
                </div>
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
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">Purpose</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground h-14">No of manpower needed</TableHead>
                            <TableHead className="w-[50px] pr-6 h-14"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
                                        <p className="font-medium animate-pulse">Loading requests...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-48">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                        <p className="font-medium">No manpower requests found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map((req) => (
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
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
