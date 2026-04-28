"use client";

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TAApprover, SystemUser, Department } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { TAAssignmentDialog } from "./TAAssignmentDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePagination, usePagination } from "./TablePagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { Building2, ShieldCheck, Mail, Search, Users, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const getObj = (val: number | unknown | undefined) => typeof val === 'object' ? val : null;

interface TimeAndAttendanceCommitteeTabProps {
  data: TAApprover[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
  onCreate: (data: Partial<TAApprover>) => Promise<void>;
  users: SystemUser[];
  departments: Department[];
}

export function TimeAndAttendanceCommitteeTab({ data, isLoading, onDelete, onCreate, users, departments }: TimeAndAttendanceCommitteeTabProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = React.useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    if (!searchQuery) return safeData;
    const query = searchQuery.toLowerCase();
    
    return safeData.filter(item => {
      const dept = getObj(item.department_id) as Department | null || 
                 departments.find(d => d.department_id === Number(item.department_id));
      const approver = getObj(item.approver_id) as SystemUser | null ||
                    users.find(u => u.user_id === Number(item.approver_id));
      
      return (
        dept?.department_name.toLowerCase().includes(query) ||
        `${approver?.user_fname} ${approver?.user_lname} ${approver?.user_email}`.toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery, departments, users]);

  const pagination = usePagination(filteredData, 5);

  if (isLoading) {
    return <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-card p-5 rounded-2xl border border-muted-foreground/10 shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground/90">Time & Attendance Committee</h3>
          <p className="text-sm text-muted-foreground font-medium">Map departments to their authorized draft approvers.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Search mappings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-muted/30 border-none rounded-xl focus-visible:ring-primary/20"
            />
          </div>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="h-11 rounded-xl px-5 bg-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 font-bold"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add Approver
          </Button>
        </div>
      </div>

      <TAAssignmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New Approval Assignment"
        users={users}
        departments={departments}
        existingAssignments={data}
        onConfirm={onCreate}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            try {
              await onDelete(deleteTarget);
              toast.success("Assignment Revoked", {
                description: "The approval mapping has been removed successfully."
              });
            } catch {
              toast.error("Revocation Failed", {
                description: "Failed to remove the mapping. Please try again."
              });
            }
          }
        }}
        title="Revoke Approval Authority?"
        description="This will remove the mapping between the department and the approver. Current drafts may need re-assignment."
      />

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-muted-foreground/10">
              <TableHead className="font-bold py-5 px-6 text-foreground/70 uppercase text-[11px] tracking-wider">Approval Authority</TableHead>
              <TableHead className="font-bold py-5 text-foreground/70 uppercase text-[11px] tracking-wider">Target Department</TableHead>
              <TableHead className="font-bold py-5 text-foreground/70 uppercase text-[11px] tracking-wider">Level</TableHead>
              <TableHead className="font-bold py-5 text-foreground/70 uppercase text-[11px] tracking-wider">Created</TableHead>
              <TableHead className="w-[80px] py-5"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-72 text-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center space-y-4 opacity-40">
                    <div className="p-5 bg-muted rounded-2xl">
                      <Users className="h-12 w-12" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">No mappings found</p>
                      <p className="text-sm">Start by assigning an approver to an employee.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item) => {
                const dept = (getObj(item.department_id) as Department | null) || 
                            departments.find(d => d.department_id === Number(item.department_id));
                const approver = (getObj(item.approver_id) as SystemUser | null) ||
                              users.find(u => u.user_id === Number(item.approver_id));
                const appInitials = approver ? `${approver.user_fname?.[0] || ''}${approver.user_lname?.[0] || ''}` : '?';

                return (
                  <TableRow key={item.id} className="group border-muted-foreground/5 hover:bg-primary/[0.02] transition-colors">
                    <TableCell className="py-5 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-muted-foreground/10 shadow-sm ring-2 ring-primary/5">
                          <AvatarFallback className="bg-violet-50 text-violet-600 font-bold text-xs">
                            {appInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-foreground/90 leading-none flex items-center gap-1.5">
                            {approver?.user_fname} {approver?.user_lname}
                            <ShieldCheck className="h-3 w-3 text-violet-500/50" />
                          </div>
                          <div className="text-[11px] text-muted-foreground font-semibold mt-1 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {approver?.user_email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/5 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-bold text-foreground/90 leading-none">
                            {dept?.department_name || "Unknown Dept"}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-semibold mt-1 uppercase tracking-wider">
                            {dept?.department_code || `ID: ${item.department_id}`}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="inline-flex items-center justify-center h-7 px-2.5 rounded-full bg-primary/5 text-primary text-[11px] font-extrabold border border-primary/10">
                        Level {item.level}
                      </div>
                    </TableCell>
                    <TableCell className="py-5">
                      <div className="text-sm text-muted-foreground font-medium">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="py-5 pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        onClick={() => setDeleteTarget(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination {...pagination} />
      </Card>
    </div>
  );
}
