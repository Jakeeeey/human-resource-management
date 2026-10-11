"use client";

import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Layers,
  ShieldCheck,
  Building2,
  Table as TableIcon,
  Plus,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  FileText,
} from "lucide-react";

import { useLguLeaveHierarchy } from "./hooks/useLguLeaveHierarchy";
import { HierarchyStats } from "./components/HierarchyStats";
import { HierarchyPipelineVisualizer } from "./components/HierarchyPipelineVisualizer";
import { ApproversDataTable } from "./components/ApproversDataTable";
import { AddApproverModal } from "./components/AddApproverModal";
import { EditApproverModal } from "./components/EditApproverModal";
import { DeleteApproverDialog } from "./components/DeleteApproverDialog";
import { LguLeaveApprover } from "./types";

export function LguLeaveApprovalHierarchyModule() {
  const {
    approvers,
    departments,
    users,
    loading,
    refreshing,
    error,
    selectedDepartmentId,
    setSelectedDepartmentId,
    selectedLevel,
    setSelectedLevel,
    searchQuery,
    setSearchQuery,
    activePipelineDepartment,
    pipelineStages,
    handleCreate,
    handleUpdate,
    handleDelete,
    refresh,
  } = useLguLeaveHierarchy();

  const [activeTab, setActiveTab] = useState<"pipeline" | "table">("pipeline");

  // Modal dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addDefaultDept, setAddDefaultDept] = useState<number | undefined>(undefined);
  const [addDefaultLevel, setAddDefaultLevel] = useState<number | undefined>(undefined);

  const [editingApprover, setEditingApprover] = useState<LguLeaveApprover | null>(null);
  const [deletingApprover, setDeletingApprover] = useState<LguLeaveApprover | null>(null);

  const handleOpenAdd = (level?: number, deptId?: number) => {
    setAddDefaultLevel(level);
    setAddDefaultDept(deptId);
    setIsAddOpen(true);
  };

  const handleResetFilters = () => {
    setSelectedDepartmentId("all");
    setSelectedLevel("all");
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Spinner className="h-8 w-8 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground animate-pulse">
          Loading LGU Leave Approval Hierarchy configurations...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-card border rounded-xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  LGU Leave Approval Hierarchy Setup
                </h2>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  CSC Form 6 Workflow Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure sequential 3-tier statutory review hierarchy per LGU department: Level 1 (Supervisor), Level 2 (HRMO Credit Certification), and Level 3 (Municipal Mayor Executive Action).
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            className="text-xs gap-1.5 h-9"
            title="Refresh Hierarchy"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-9"
          >
            <Link href="/hrm/employee-admin/approval/lgu-leave-approval">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Leave Approval
            </Link>
          </Button>

          <Button
            size="sm"
            className="text-xs font-semibold gap-1.5 h-9 shadow-xs"
            onClick={() => handleOpenAdd()}
          >
            <Plus className="h-4 w-4" />
            Assign Approver
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Stats */}
      <HierarchyStats approvers={approvers} departments={departments} />

      {/* Navigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "pipeline" | "table")}
        className="space-y-4"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <TabsList className="grid grid-cols-2 w-full sm:w-[380px]">
            <TabsTrigger value="pipeline" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Visual Flow Pipeline
            </TabsTrigger>
            <TabsTrigger value="table" className="text-xs gap-1.5">
              <TableIcon className="h-3.5 w-3.5" />
              Approvers Directory ({approvers.length})
            </TabsTrigger>
          </TabsList>

          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Compliant with CSC MC No. 71, s. 1998 & EO 292</span>
          </div>
        </div>

        {/* TAB 1: Visual Flow Pipeline */}
        <TabsContent value="pipeline" className="space-y-4">
          <HierarchyPipelineVisualizer
            departments={departments}
            selectedDepartmentId={selectedDepartmentId}
            onSelectDepartment={setSelectedDepartmentId}
            activeDepartment={activePipelineDepartment}
            pipelineStages={pipelineStages}
            onAddApproverAtLevel={(level, deptId) => handleOpenAdd(level, deptId)}
            onEditApprover={(approver) => setEditingApprover(approver)}
            onDeleteApprover={(approver) => setDeletingApprover(approver)}
          />
        </TabsContent>

        {/* TAB 2: Approver Directory Table */}
        <TabsContent value="table" className="space-y-4">
          <ApproversDataTable
            approvers={approvers}
            departments={departments}
            selectedDepartmentId={selectedDepartmentId}
            onSelectDepartment={setSelectedDepartmentId}
            selectedLevel={selectedLevel}
            onSelectLevel={setSelectedLevel}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddApprover={() => handleOpenAdd()}
            onEditApprover={(approver) => setEditingApprover(approver)}
            onDeleteApprover={(approver) => setDeletingApprover(approver)}
            onResetFilters={handleResetFilters}
          />
        </TabsContent>
      </Tabs>

      {/* Modals & Dialogs */}
      <AddApproverModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        departments={departments}
        users={users}
        defaultDepartmentId={addDefaultDept}
        defaultLevel={addDefaultLevel}
        onSubmit={handleCreate}
      />

      <EditApproverModal
        isOpen={Boolean(editingApprover)}
        onClose={() => setEditingApprover(null)}
        approver={editingApprover}
        departments={departments}
        onSubmit={handleUpdate}
      />

      <DeleteApproverDialog
        isOpen={Boolean(deletingApprover)}
        onClose={() => setDeletingApprover(null)}
        approver={deletingApprover}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default LguLeaveApprovalHierarchyModule;
