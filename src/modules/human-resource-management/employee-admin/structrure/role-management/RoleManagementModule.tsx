/**
 * Role Management Module
 * Main orchestrator component using shadcn Tabs
 */

"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Users, 
  ShieldCheck, 
  Briefcase, 
  UserPlus, 
  UserCircle2,
  AlertCircle, 
  RefreshCw,
  CircleDollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoleManagement } from "./hooks/useRoleManagement";
import {
  ExecutiveTab,
  ReviewCommitteeTab,
  DivisionHeadTab,
  SupervisorTab,
  SalesmanTab,
  ExpenseReviewCommitteeTab
} from "./components/index";

export default function RoleManagementModule() {
  const {
    executives,
    reviewCommittee,
    expenseReviewCommittee,
    divisionHeads,
    supervisors,
    salesmanAssignments,
    users,
    divisions,
    salesmen,
    isLoading,
    isError,
    error,
    refetch,
    deleteExecutive,
    createExecutive,
    deleteReviewCommittee,
    createReviewCommittee,
    deleteExpenseReviewCommittee,
    createExpenseReviewCommittee,
    deleteDivisionHead,
    createDivisionHead,
    deleteSupervisor,
    createSupervisor,
    deleteSalesmanAssignment,
    createSalesmanAssignment,
  } = useRoleManagement();

  if (isError) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>Failed to load data: {error?.message || "Unknown error"}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Role Management
            </h1>
          </div>
          <p className="text-muted-foreground text-sm pl-11">
            Orchestrate organizational hierarchy and system authority assignments.
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isLoading}
          className="rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Registry
        </Button>
      </div>

      <Tabs defaultValue="executive" className="w-full">
        <TabsList variant="line" className="w-full justify-start border-b gap-8 h-12 bg-transparent px-0">
          <TabsTrigger value="executive" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <Users className="h-4 w-4" /> Executive
          </TabsTrigger>
          <TabsTrigger value="review-committee" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <ShieldCheck className="h-4 w-4" /> Target Review Committee
          </TabsTrigger>
          <TabsTrigger value="expense-review-committee" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <CircleDollarSign className="h-4 w-4" /> Expense Review Committee
          </TabsTrigger>
          <TabsTrigger value="division-head" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <Briefcase className="h-4 w-4" /> Division Head
          </TabsTrigger>
          <TabsTrigger value="supervisor" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <UserPlus className="h-4 w-4" /> Supervisor
          </TabsTrigger>
          <TabsTrigger value="salesman" className="after:bottom-0 gap-2 text-base data-[state=active]:text-primary">
            <UserCircle2 className="h-4 w-4" /> Salesman
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive" className="mt-0">
          <ExecutiveTab
            data={executives}
            isLoading={isLoading}
            users={users}
            onDelete={deleteExecutive}
            onCreate={createExecutive}
          />
        </TabsContent>

        <TabsContent value="review-committee" className="mt-0">
          <ReviewCommitteeTab
            data={reviewCommittee}
            isLoading={isLoading}
            onDelete={deleteReviewCommittee}
            onCreate={async (userId: number) => {
              await createReviewCommittee({ approver_id: userId });
            }}
            users={users}
          />
        </TabsContent>

        <TabsContent value="expense-review-committee" className="mt-0">
          <ExpenseReviewCommitteeTab
            data={expenseReviewCommittee}
            isLoading={isLoading}
            users={users}
            divisions={divisions}
            onDelete={deleteExpenseReviewCommittee}
            onCreate={createExpenseReviewCommittee}
          />
        </TabsContent>

        <TabsContent value="division-head" className="mt-0">
          <DivisionHeadTab
            data={divisionHeads}
            isLoading={isLoading}
            users={users}
            divisions={divisions}
            onDelete={deleteDivisionHead}
            onCreate={createDivisionHead}
          />
        </TabsContent>

        <TabsContent value="supervisor" className="mt-0">
          <SupervisorTab 
            data={supervisors} 
            isLoading={isLoading} 
            users={users}
            divisions={divisions}
            onDelete={deleteSupervisor}
            onCreate={createSupervisor}
          />
        </TabsContent>

        <TabsContent value="salesman" className="mt-0">
          <SalesmanTab 
            data={salesmanAssignments} 
            isLoading={isLoading} 
            users={users}
            salesmen={salesmen}
            supervisors={supervisors}
            onDelete={deleteSalesmanAssignment}
            onCreate={createSalesmanAssignment}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
