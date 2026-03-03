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
import { Trash2, UserPlus, Mail, Briefcase, User } from "lucide-react";
import { Executive, SystemUser } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAssignmentDialog } from "./RoleAssignmentDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { TablePagination, usePagination } from "./TablePagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

const getUser = (val: number | SystemUser | undefined) => typeof val === 'object' ? val : null;

interface ExecutiveTabProps {
  data: Executive[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
  onCreate: (userId: number) => Promise<void>;
  users: SystemUser[];
}

export function ExecutiveTab({ data, isLoading, onDelete, onCreate, users }: ExecutiveTabProps) {
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
          <h3 className="text-lg font-semibold tracking-tight">Executive Registry</h3>
          <p className="text-sm text-muted-foreground">Highest level authority assignments.</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="rounded-full px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Add Executive
        </Button>
      </div>

      <RoleAssignmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Add Executive"
        type="executive"
        users={users}
        onConfirm={onCreate}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
        }}
        title="Remove Executive?"
        description="Are you sure you want to remove this executive? This action cannot be undone."
      />

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden rounded-xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-muted-foreground/10">
              <TableHead className="font-semibold py-4 px-6 text-foreground/80">Executive Name</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Contact Information</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Corporate Position</TableHead>
              <TableHead className="w-[80px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                    <div className="p-4 bg-muted rounded-full">
                      <User className="h-10 w-10" />
                    </div>
                    <p className="text-base font-medium">No executives assigned yet</p>
                    <p className="text-sm">Assigned executives will appear here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item) => {
                const user = getUser(item.user_id);
                const initials = user ? `${user.user_fname?.[0] || ''}${user.user_lname?.[0] || ''}` : '?';

                return (
                  <TableRow key={item.id} className="group border-muted-foreground/10 hover:bg-muted/30 transition-colors">
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-muted-foreground/10 shadow-sm group-hover:scale-105 transition-transform">
                          <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs tracking-tighter">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold text-foreground/90 tracking-tight leading-tight">
                            {user?.user_fname} {user?.user_lname}
                          </div>
                          <div className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5 opacity-60">
                            ID: #{item.id}
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
                    <TableCell className="py-4 text-sm">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-secondary/40 text-secondary-foreground rounded-full font-semibold text-[12px] border border-secondary/20">
                        <Briefcase className="h-[14px] w-[14px] opacity-60" />
                        {user?.user_position}
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

