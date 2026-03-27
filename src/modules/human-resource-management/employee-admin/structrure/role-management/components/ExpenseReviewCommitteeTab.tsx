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
import { Trash2, Plus, Mail, LayoutDashboard, Filter, XCircle } from "lucide-react";
import { ExpenseReviewCommittee, SystemUser, Division } from "../types";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleAssignmentDialog } from "./RoleAssignmentDialog";
import { SearchableSelect } from "./SearchableSelect";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { TablePagination, usePagination } from "./TablePagination";
import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";
import { Badge } from "@/components/ui/badge";

const getUser = (val: number | SystemUser | undefined) => typeof val === 'object' ? val : null;
const getDivision = (val: number | Division | undefined) => typeof val === 'object' ? val : null;

interface ExpenseReviewCommitteeTabProps {
  data: ExpenseReviewCommittee[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<void>;
  onCreate: (divisionId: number, userId: number, hierarchy: number) => Promise<void>;
  users: SystemUser[];
  divisions: Division[];
}

export function ExpenseReviewCommitteeTab({ data, isLoading, onDelete, onCreate, users, divisions }: ExpenseReviewCommitteeTabProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<number | null>(null);
  const [filterDivision, setFilterDivision] = React.useState<string>("all");

  const filteredData = React.useMemo(() => {
    if (filterDivision === "all") return data;
    return data.filter(item => {
      const divId = typeof item.division_id === 'object' ? item.division_id.division_id : item.division_id;
      return divId.toString() === filterDivision;
    });
  }, [data, filterDivision]);

  const pagination = usePagination(filteredData, 5);

  const divisionOptions = React.useMemo(() => [
    { value: "all", label: "All Business Units" },
    ...divisions.map(d => ({ value: d.division_id.toString(), label: d.division_name }))
  ], [divisions]);

  const getHierarchyColor = (level: number) => {
    switch (level) {
      case 1: return "bg-primary/10 text-primary ring-primary/20";
      case 2: return "bg-primary/30 text-primary ring-primary/40";
      case 3: return "bg-primary/60 text-primary-foreground ring-primary/70";
      default: 
        if (level >= 4) return "bg-primary text-primary-foreground ring-primary/90 shadow-md";
        return "bg-primary/10 text-primary ring-primary/20";
    }
  };

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
          <h3 className="text-lg font-semibold tracking-tight text-foreground/90">Expense Review Committee</h3>
          <p className="text-sm text-muted-foreground font-medium">Approval authority for financial disbursements and expenses.</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          disabled={divisions.length === 0}
          className="rounded-full px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 disabled:grayscale"
        >
          <Plus className="mr-2 h-4 w-4" />
          Assign Reviewer
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl border border-muted-foreground/5 shadow-inner">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-muted-foreground/10 shadow-sm w-full md:w-[320px]">
          <Filter className="h-4 w-4 text-muted-foreground opacity-60" />
          <SearchableSelect
            options={divisionOptions}
            value={filterDivision}
            onValueChange={setFilterDivision}
            placeholder="Filter by Business Unit"
            className="border-none bg-transparent h-7 focus:ring-0 shadow-none font-bold text-xs"
          />
          {filterDivision !== "all" && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setFilterDivision("all")}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="hidden md:block h-4 w-[1px] bg-muted-foreground/10 mx-2" />
        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest hidden md:block">
          Showing <span className="text-foreground">{filteredData.length}</span> Members
        </p>
      </div>

      <RoleAssignmentDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="Assign Expense Review Committee Approver"
        type="expense-review-committee" 
        users={users}
        divisions={divisions}
        expenseReviewers={data}
        onConfirm={onCreate}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await onDelete(deleteTarget);
        }}
        title="Remove Expense Review Committee Member?"
        description="Are you sure you want to remove this approver? This action cannot be undone."
      />

      <Card className="border-muted-foreground/10 shadow-sm overflow-hidden rounded-xl">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-muted-foreground/10">
              <TableHead className="font-semibold py-4 px-6 text-foreground/80">Managing Unit</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Committee Member Name</TableHead>
              <TableHead className="font-semibold py-4 text-foreground/80">Contact</TableHead>
              <TableHead className="font-semibold py-4 text-center text-foreground/80">Hierarchy Level</TableHead>
              <TableHead className="w-[80px] py-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center pointer-events-none">
                  <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                    <div className="p-4 bg-muted rounded-full">
                      <LayoutDashboard className="h-10 w-10" />
                    </div>
                    <p className="text-base font-medium">
                      {filterDivision !== "all" ? "No members for this business unit" : "No expense review committee members assigned"}
                    </p>
                    <p className="text-sm">
                      {filterDivision !== "all" ? "Try adjusting your filter or assign a new member." : "Start by assigning an approver to a business unit."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((item) => {
                const user = getUser(item.approver_id);
                const division = getDivision(item.division_id);
                const initials = user ? `${user.user_fname?.[0] || ''}${user.user_lname?.[0] || ''}` : '?';

                return (
                  <TableRow key={item.id} className="group border-muted-foreground/10 hover:bg-muted/30 transition-colors">
                    <TableCell className="py-4 px-6">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 font-bold text-[11px] tracking-wider uppercase">
                        {division?.division_name || `ID #${item.division_id}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-muted-foreground/10 shadow-sm transition-transform group-hover:scale-105">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] tracking-tight">
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
                    <TableCell className="py-4 text-center">
                      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ring-1 transition-all ${getHierarchyColor(item.approver_heirarchy || 1)}`}>
                        {item.approver_heirarchy || 1}
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
