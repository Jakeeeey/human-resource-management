"use client";

import { useHandbook } from "../hooks/useHandbook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Plus, FileText, Search, Book, Calendar, User, Eye, MoreVertical, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function HandbookList() {
    const { handbooks, isLoading, error, setIsCreateOpen, handleView, searchQuery, setSearchQuery, setSelectedHandbook, setIsEditOpen } = useHandbook();

    if (error) {
        return (
            <div className="p-6 text-red-600 bg-red-50 border border-red-100 rounded-xl shadow-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <p className="font-medium">Error loading handbooks: {error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1">
                <div className="relative w-full sm:w-80 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <Input
                        placeholder="Search by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-background/50 border-muted-foreground/20 focus-visible:ring-primary/30 rounded-full shadow-sm h-10 transition-all hover:bg-background"
                    />
                </div>
                <Button 
                    onClick={() => setIsCreateOpen(true)}
                    className="w-full sm:w-auto rounded-full shadow-sm hover:shadow-md transition-all duration-300"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    New Handbook
                </Button>
            </div>

            {/* Main Content Area */}
            <div className="bg-card border border-border/40 shadow-sm rounded-2xl overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-b-border/40">
                            <TableHead className="py-4 pl-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Book className="w-3.5 h-3.5" />
                                    Title
                                </div>
                            </TableHead>
                            <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Date Created
                                </div>
                            </TableHead>
                            <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <User className="w-3.5 h-3.5" />
                                    Created By
                                </div>
                            </TableHead>
                            <TableHead className="py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Attachments
                            </TableHead>
                            <TableHead className="py-4 pr-6 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-sm font-medium">Loading handbooks...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : handbooks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center">
                                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <div className="p-4 bg-muted/20 rounded-full mb-3">
                                            <Book className="w-8 h-8 text-muted-foreground/50" />
                                        </div>
                                        <p className="text-sm font-medium">No handbooks found.</p>
                                        <p className="text-xs mt-1 opacity-70">Try adjusting your search or create a new one.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            handbooks.map((handbook) => (
                                <TableRow 
                                    key={handbook.id}
                                    className="group hover:bg-muted/20 border-b-border/40 transition-colors duration-200"
                                >
                                    <TableCell className="py-4 pl-6">
                                        <div className="font-semibold text-foreground truncate max-w-[300px]">
                                            {handbook.title}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="text-sm text-muted-foreground font-medium">
                                            {handbook.created_at ? format(new Date(handbook.created_at), "MMM d, yyyy") : "-"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <span className="text-xs font-bold text-primary">
                                                    {(handbook.created_by_name || "U")[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium">{handbook.created_by_name || "Unknown"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        {handbook.attachments && handbook.attachments.length > 0 ? (
                                            <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20 gap-1.5">
                                                <FileText className="w-3.5 h-3.5" />
                                                <span className="text-xs font-bold">{handbook.attachments.length}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-medium text-muted-foreground px-2.5 py-1 rounded-full bg-muted/50">None</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-4 pr-6 text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 rounded-full opacity-70 group-hover:opacity-100 transition-opacity">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreVertical className="h-5 w-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[160px]">
                                                <DropdownMenuItem onClick={() => handleView(handbook)} className="cursor-pointer">
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    <span>View</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setSelectedHandbook(handbook); setIsEditOpen(true); }} className="cursor-pointer">
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Edit</span>
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
