"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, UserPlus, Mail, ShieldCheck } from "lucide-react";
import { ReviewCommittee, SystemUser } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAssignmentDialog } from "./RoleAssignmentDialog";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { TablePagination, usePagination } from "./TablePagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

const getUser = (val: number | SystemUser | undefined) => typeof val === 'object' ? val : null;

interface ReviewCommitteeTabProps {
  data: ReviewCommittee[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
  onCreate: (userId: number) => Promise<void>;
  users: SystemUser[];
}

export function ReviewCommitteeTab({ data, isLoading, onDelete, onCreate, users }: ReviewCommitteeTabProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const pagination = usePagination(data, 5);

  if (isLoading) {
    return <div className="space-y-4">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-muted-foreground/10 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Target Review Committee</h3>
          <p className="text-sm text-muted-foreground font-medium">Regulatory approval authority for targets.</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="rounded-full px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Target Approver
        </Button>
      </div>

      <RoleAssignmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Add Target Review Committee Approver"
        type="review-committee"
        users={users}
        onConfirm={onCreate}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
        }}
        title="Remove Committee Member?"
        description="Are you sure you want to remove this member? This action cannot be undone."
      />

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden rounded-xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-muted-foreground/10">
              <TableHead className="font-semibold py-4 px-6 text-foreground/80">Approval Authority</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Contact</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Added On</TableHead>
              <TableHead className="w-[80px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                    <div className="p-4 bg-muted rounded-full">
                      <ShieldCheck className="h-10 w-10" />
                    </div>
                    <p className="text-base font-medium">No committee members</p>
                    <p className="text-sm">Designate target setting approvers here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item) => {
                const user = getUser(item.approver_id);
                const initials = user ? `${user.user_fname?.[0] || ''}${user.user_lname?.[0] || ''}` : '?';

                return (
                  <TableRow key={item.id} className="group border-muted-foreground/10 hover:bg-muted/30 transition-colors">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-muted-foreground/10 shadow-sm transition-transform group-hover:scale-105">
                          <AvatarFallback className="bg-primary/5 text-primary font-bold text-[10px] tracking-tight">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-foreground/90 tracking-tight leading-tight">
                            {user?.user_fname} {user?.user_lname}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-semibold mt-0.5 opacity-70">
                            {user?.user_position}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                        <Mail className="h-3.5 w-3.5 opacity-40" />
                        {user?.user_email}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="text-sm text-muted-foreground font-medium">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-all active:scale-90"
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

