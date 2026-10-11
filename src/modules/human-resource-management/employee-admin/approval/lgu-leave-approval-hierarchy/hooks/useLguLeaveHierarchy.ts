"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  LguLeaveApprover,
  DepartmentInfo,
  UserInfo,
  CreateApproverInput,
  UpdateApproverInput,
  SetupDepartmentHierarchyInput,
  BatchApplyStandardApproversInput,
  DepartmentHierarchySummary,
  HierarchyPipelineStage,
  LGU_HIERARCHY_LEVELS,
} from "../types";
import {
  fetchHierarchyData,
  createApproverApi,
  updateApproverApi,
  deleteApproverApi,
  setupDepartmentHierarchyApi,
  batchApplyStandardApproversApi,
} from "../api/lguLeaveHierarchyApi";

export function useLguLeaveHierarchy() {
  const [approvers, setApprovers] = useState<LguLeaveApprover[]>([]);
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const res = await fetchHierarchyData({
        departmentId: selectedDepartmentId !== "all" ? selectedDepartmentId : undefined,
        level: selectedLevel !== "all" ? selectedLevel : undefined,
        search: searchQuery.trim() || undefined,
      });

      setApprovers(res.data);
      setDepartments(res.departments);
      setUsers(res.users);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load approval hierarchy";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDepartmentId, selectedLevel, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Hierarchical Pipeline for visualizer (if a department is selected, or for the primary department)
  const activePipelineDepartment = useMemo(() => {
    if (selectedDepartmentId !== "all") {
      const dept = departments.find((d) => String(d.department_id) === selectedDepartmentId);
      return dept || departments[0] || null;
    }
    return departments[0] || null;
  }, [selectedDepartmentId, departments]);

  const pipelineStages: HierarchyPipelineStage[] = useMemo(() => {
    if (!activePipelineDepartment) return [];

    const deptApprovers = approvers.filter(
      (a) => a.department_id === activePipelineDepartment.department_id
    );

    return LGU_HIERARCHY_LEVELS.map((stage) => {
      const stageApprovers = deptApprovers.filter((a) => a.level === stage.level);
      return {
        level: stage.level,
        title: stage.title,
        subtitle: stage.subtitle,
        section: stage.section,
        roleName: stage.roleName,
        approvers: stageApprovers,
      };
    });
  }, [activePipelineDepartment, approvers]);

  // Department Summaries for the Matrix View
  const departmentSummaries: DepartmentHierarchySummary[] = useMemo(() => {
    return departments.map((dept) => {
      const deptApprovers = approvers.filter(
        (a) => a.department_id === dept.department_id
      );
      const l1 = deptApprovers.find((a) => a.level === 1) || null;
      const l2 = deptApprovers.find((a) => a.level === 2) || null;
      const l3 = deptApprovers.find((a) => a.level === 3) || null;

      let configuredCount = 0;
      if (l1) configuredCount++;
      if (l2) configuredCount++;
      if (l3) configuredCount++;

      let status: "complete" | "partial" | "empty" = "empty";
      if (configuredCount === 3) status = "complete";
      else if (configuredCount > 0) status = "partial";

      return {
        department: dept,
        level1Approver: l1,
        level2Approver: l2,
        level3Approver: l3,
        status,
        configuredLevelsCount: configuredCount,
      };
    });
  }, [departments, approvers]);

  // Actions
  const handleCreate = async (input: CreateApproverInput) => {
    try {
      await createApproverApi(input);
      toast.success("Approver successfully added to hierarchy");
      await loadData(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add approver";
      toast.error(msg);
      return false;
    }
  };

  const handleUpdate = async (input: UpdateApproverInput) => {
    try {
      await updateApproverApi(input);
      toast.success("Approver assignment updated");
      await loadData(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update approver";
      toast.error(msg);
      return false;
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteApproverApi(id);
      toast.success("Approver removed from hierarchy");
      await loadData(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete approver";
      toast.error(msg);
      return false;
    }
  };

  const handleSetupDepartment = async (input: SetupDepartmentHierarchyInput) => {
    try {
      await setupDepartmentHierarchyApi(input);
      toast.success("Department hierarchy configured successfully");
      await loadData(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to setup department hierarchy";
      toast.error(msg);
      return false;
    }
  };

  const handleBatchApplyStandard = async (input: BatchApplyStandardApproversInput) => {
    try {
      await batchApplyStandardApproversApi(input);
      toast.success("Standard approvers successfully applied across selected departments");
      await loadData(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to batch apply standard approvers";
      toast.error(msg);
      return false;
    }
  };

  return {
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
    departmentSummaries,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleSetupDepartment,
    handleBatchApplyStandard,
    refresh: () => loadData(true),
  };
}
