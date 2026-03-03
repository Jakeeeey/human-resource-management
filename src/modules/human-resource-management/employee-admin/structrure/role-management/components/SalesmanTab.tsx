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
import { Trash2, Plus, UserCircle2, UserCircle, Hash } from "lucide-react";
import { SalesmanPerSupervisor, Salesman, SupervisorPerDivision, SystemUser, Division } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAssignmentDialog } from "./RoleAssignmentDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { TablePagination, usePagination } from "./TablePagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { Badge } from "@/components/ui/badge";

const getUser = (val: number | SystemUser | undefined) => typeof val === 'object' ? val : null;
const getDivision = (val: number | Division | undefined) => typeof val === 'object' ? val : null;
const getSupervisorAsmt = (val: number | SupervisorPerDivision | undefined) => typeof val === 'object' ? val : null;
const getSalesman = (val: number | Salesman | undefined) => typeof val === 'object' ? val : null;

interface SalesmanTabProps {
  data: SalesmanPerSupervisor[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
  onCreate: (supDivId: number, salesmanId: number) => Promise<void>;
  salesmen: Salesman[];
  supervisors: SupervisorPerDivision[];
  users: SystemUser[];
}

export function SalesmanTab({ data, isLoading, onDelete, onCreate, salesmen, supervisors, users }: SalesmanTabProps) {
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
          <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Sales Force</h3>
          <p className="text-sm text-muted-foreground font-medium">Frontline personnel assigned to supervisors.</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="rounded-full px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
        >
          <Plus className="mr-2 h-4 w-4" /> Assign Salesman
        </Button>
      </div>

      <RoleAssignmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Assign Salesman"
        type="salesman"
        users={users}
        salesmen={salesmen}
        supervisors={supervisors}
        onConfirm={async (supDivId: number, smId: number) => {
          await onCreate(supDivId, smId);
        }}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
        }}
        title="Unassign Salesman?"
        description="Are you sure you want to unassign this salesman from the supervisor? This action cannot be undone."
      />

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden rounded-xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-muted-foreground/10">
              <TableHead className="font-semibold py-4 px-6 text-foreground/80">Reporting To</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Sales Executive</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Access Code</TableHead>
              <TableHead className="w-[80px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-64 text-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                    <div className="p-4 bg-muted rounded-full">
                      <UserCircle2 className="h-10 w-10" />
                    </div>
                    <p className="text-base font-medium">No salesmen assigned yet</p>
                    <p className="text-sm">Connect salesmen to their supervisors here.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item) => {
                const salesman = getSalesman(item.salesman_id);
                const supAsmt = getSupervisorAsmt(item.supervisor_per_division_id);
                const supUser = getUser(supAsmt?.supervisor_id);
                const division = getDivision(supAsmt?.division_id);

                const initials = salesman?.salesman_name
                  ? salesman.salesman_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                  : '?';

                return (
                  <TableRow key={item.id} className="group border-muted-foreground/10 hover:bg-muted/30 transition-colors">
                    <TableCell className="py-4 px-6">
                      <div className="space-y-1.5">
                        <div className="font-bold text-foreground/90 text-sm flex items-center gap-1.5">
                          <UserCircle className="h-4 w-4 opacity-50 text-primary" />
                          {supUser?.user_fname} {supUser?.user_lname}
                        </div>
                        <Badge variant="outline" className="text-[9px] h-5 px-1.5 py-0 font-black tracking-tighter uppercase opacity-80 border-muted-foreground/20">
                          {division?.division_name}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-muted-foreground/10 shadow-sm transition-transform group-hover:scale-105">
                          <AvatarFallback className="bg-primary/5 text-primary font-bold text-[10px] tracking-tight">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="font-bold text-foreground/85 tracking-tight">
                          {salesman?.salesman_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="inline-flex items-center gap-1.5 text-xs font-mono bg-muted/50 px-2 py-0.5 rounded border border-muted-foreground/10 text-muted-foreground">
                        <Hash className="h-3 w-3 opacity-40" />
                        {salesman?.salesman_code}
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

