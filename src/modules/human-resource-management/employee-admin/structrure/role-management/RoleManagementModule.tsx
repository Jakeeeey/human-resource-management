/**
 * Role Management Module
 * Orchestrates organizational hierarchy and approval authority assignments.
 * Uses a categorized tab system to prevent UI overflow and improve UX.
 */

"use client";

import React, { useState } from "react";
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
  CircleDollarSign,
  Layers,
  Settings2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoleManagement } from "./hooks/useRoleManagement";
import {
  ExecutiveTab,
  ReviewCommitteeTab,
  DivisionHeadTab,
  SupervisorTab,
  SalesmanTab,
  ExpenseReviewCommitteeTab,
} from "./components/index";
import { TimeAndAttendanceCommitteeTab } from "./components/TimeAndAttendanceCommitteeTab";
import { cn } from "@/lib/utils";

export default function RoleManagementModule() {
  const [activeCategory, setActiveCategory] = useState<"hierarchy" | "committee">("hierarchy");

  const {
    executives,
    reviewCommittee,
    expenseReviewCommittee,
    divisionHeads,
    supervisors,
    salesmanAssignments,
    taApprovers,
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
    createTAApprover,
    deleteTAApprover,
    departments
  } = useRoleManagement();

  if (isError) {
    return (
      <Alert variant="destructive" className="mb-6 mx-4">
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
    <div className="space-y-6 max-w-[1500px] mx-auto px-6 py-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 shadow-inner">
            <ShieldCheck className="h-8 w-8 text-primary shadow-sm" />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent italic">
              Authority Registry
            </h1>
            <p className="text-muted-foreground text-sm font-medium mt-1">
              Configure organizational lineage and system-wide approval committees.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isLoading}
          className="rounded-xl px-5 h-10 border-muted-foreground/10 bg-background/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all active:scale-95"
        >
          <RefreshCw className={`mr-2 h-4 w-4 text-primary/60 ${isLoading ? "animate-spin" : ""}`} />
          <span className="font-bold text-xs uppercase tracking-widest">Refresh Registry</span>
        </Button>
      </div>

      {/* Category Selection (Top Level) */}
      <div className="flex items-center gap-2 p-1.5 bg-muted/30 rounded-2xl border border-muted-foreground/5 w-fit">
        <button
          onClick={() => setActiveCategory("hierarchy")}
          className={cn(
            "flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
            activeCategory === "hierarchy" 
              ? "bg-background text-foreground shadow-xl ring-1 ring-black/5" 
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground/70"
          )}
        >
          <Layers className={cn("h-4 w-4", activeCategory === "hierarchy" ? "text-primary" : "opacity-40")} />
          Hierarchy Management
        </button>
        <button
          onClick={() => setActiveCategory("committee")}
          className={cn(
            "flex items-center gap-2.5 px-6 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
            activeCategory === "committee" 
              ? "bg-background text-foreground shadow-xl ring-1 ring-black/5" 
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground/70"
          )}
        >
          <Settings2 className={cn("h-4 w-4", activeCategory === "committee" ? "text-primary" : "opacity-40")} />
          Approval Committees
        </button>
      </div>

      {/* Module Content */}
      <div className="relative overflow-hidden">
        {activeCategory === "hierarchy" ? (
          <Tabs key="hierarchy-tabs" defaultValue="executive" className="w-full animate-in slide-in-from-left-4 duration-500">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 bg-primary/20 rounded-full mr-2" />
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                {[
                  { value: "executive", label: "Executive", icon: Users },
                  { value: "division-head", label: "Division Head", icon: Briefcase },
                  { value: "supervisor", label: "Supervisor", icon: UserPlus },
                  { value: "salesman", label: "Salesman", icon: UserCircle2 },
                ].map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="p-0 bg-transparent data-[state=active]:bg-transparent shadow-none border-none group"
                  >
                    <div className="flex flex-col items-center gap-1 w-max">
                      <div className="flex items-center gap-2 px-1 py-0.5 group-data-[state=active]:text-primary transition-colors whitespace-nowrap">
                        <item.icon className="h-4 w-4 opacity-50 group-data-[state=active]:opacity-100" />
                        <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>
                      </div>
                      <div className="h-1 w-0 group-data-[state=active]:w-full bg-primary rounded-full transition-all duration-300" />
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="executive" className="mt-0 outline-none">
              <ExecutiveTab data={executives} isLoading={isLoading} users={users} onDelete={deleteExecutive} onCreate={createExecutive} />
            </TabsContent>
            <TabsContent value="division-head" className="mt-0 outline-none">
              <DivisionHeadTab data={divisionHeads} isLoading={isLoading} users={users} divisions={divisions} onDelete={deleteDivisionHead} onCreate={createDivisionHead} />
            </TabsContent>
            <TabsContent value="supervisor" className="mt-0 outline-none">
              <SupervisorTab data={supervisors} isLoading={isLoading} users={users} divisions={divisions} onDelete={deleteSupervisor} onCreate={createSupervisor} />
            </TabsContent>
            <TabsContent value="salesman" className="mt-0 outline-none">
              <SalesmanTab data={salesmanAssignments} isLoading={isLoading} users={users} salesmen={salesmen} supervisors={supervisors} onDelete={deleteSalesmanAssignment} onCreate={createSalesmanAssignment} />
            </TabsContent>
          </Tabs>
        ) : (
          <Tabs key="committee-tabs" defaultValue="review-committee" className="w-full animate-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-5 w-1 bg-violet-500/20 rounded-full mr-2" />
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                {[
                  { value: "review-committee", label: "Target Review", icon: ShieldCheck },
                  { value: "expense-review-committee", label: "Expense Review", icon: CircleDollarSign },
                  { value: "ta-committee", label: "TA Committee", icon: Clock },
                ].map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="p-0 bg-transparent data-[state=active]:bg-transparent shadow-none border-none group"
                  >
                    <div className="flex flex-col items-center gap-1 w-max">
                      <div className="flex items-center gap-2 px-1 py-0.5 group-data-[state=active]:text-violet-600 transition-colors whitespace-nowrap">
                        <item.icon className="h-4 w-4 opacity-50 group-data-[state=active]:opacity-100" />
                        <span className="font-bold text-sm tracking-tight whitespace-nowrap">{item.label}</span>
                      </div>
                      <div className="h-1 w-0 group-data-[state=active]:w-full bg-violet-500 rounded-full transition-all duration-300" />
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="review-committee" className="mt-0 outline-none">
              <ReviewCommitteeTab
                data={reviewCommittee}
                isLoading={isLoading}
                onDelete={deleteReviewCommittee}
                onCreate={async (userId: number) => { await createReviewCommittee({ approver_id: userId }); }}
                users={users}
              />
            </TabsContent>
            <TabsContent value="expense-review-committee" className="mt-0 outline-none">
              <ExpenseReviewCommitteeTab
                data={expenseReviewCommittee}
                isLoading={isLoading}
                users={users}
                divisions={divisions}
                onDelete={deleteExpenseReviewCommittee}
                onCreate={createExpenseReviewCommittee}
              />
            </TabsContent>
            <TabsContent value="ta-committee" className="mt-0 outline-none">
              <TimeAndAttendanceCommitteeTab
                data={taApprovers}
                isLoading={isLoading}
                users={users}
                departments={departments}
                onDelete={deleteTAApprover}
                onCreate={createTAApprover}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
