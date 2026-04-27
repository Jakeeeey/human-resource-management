"use client";

import { useState, useCallback, useEffect } from "react";
import * as provider from "../providers/fetchProvider";
import { toast } from "sonner";
import {
  Executive,
  DivisionSalesHead,
  SupervisorPerDivision,
  SalesmanPerSupervisor,
  ReviewCommittee,
  ExpenseReviewCommittee,
  TAApprover,
  SystemUser,
  Division,
  Salesman,
  Department
} from "../types";

export function useRoleManagement() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [reviewCommittee, setReviewCommittee] = useState<ReviewCommittee[]>([]);
  const [divisionHeads, setDivisionHeads] = useState<DivisionSalesHead[]>([]);
  const [expenseReviewCommittee, setExpenseReviewCommittee] = useState<ExpenseReviewCommittee[]>([]);
  const [taApprovers, setTaApprovers] = useState<TAApprover[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorPerDivision[]>([]);
  const [salesmanAssignments, setSalesmanAssignments] = useState<SalesmanPerSupervisor[]>([]);

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // --- Granular fetch helpers (only refetch what changed) ---
  const fetchExecutives = useCallback(async () => {
    const ex = await provider.listExecutives();
    setExecutives(ex);
  }, []);

  const fetchReviewCommittee = useCallback(async () => {
    const rc = await provider.listReviewCommittee();
    setReviewCommittee(rc);
  }, []);

  const fetchDivisionHeads = useCallback(async () => {
    const dh = await provider.listDivisionHeads();
    setDivisionHeads(dh);
  }, []);

  const fetchExpenseReviewCommittee = useCallback(async () => {
    const erc = await provider.listExpenseReviewCommittee();
    setExpenseReviewCommittee(erc);
  }, []);

  const fetchSupervisors = useCallback(async () => {
    const sup = await provider.listSupervisors();
    setSupervisors(sup);
  }, []);

  const fetchSalesmanAssignments = useCallback(async () => {
    const sa = await provider.listSalesmanAssignments();
    setSalesmanAssignments(sa);
  }, []);

  const fetchTAApprovers = useCallback(async () => {
    const ta = await provider.listTAApprovers();
    setTaApprovers(ta);
  }, []);



  const fetchReferenceData = useCallback(async () => {
    try {
      const [u, d, s, depts] = await Promise.all([
        provider.listUsers(),
        provider.listDivisions(),
        provider.listSalesmen(),
        provider.listDepartments(),
      ]);
      setUsers(u);
      setDivisions(d);
      setSalesmen(s);
      setDepartments(depts);
    } catch (err) {
      console.error("Failed to fetch reference data", err);
    }
  }, []);

  // Initial Load
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      await Promise.all([
        fetchExecutives(),
        fetchReviewCommittee(),
        fetchExpenseReviewCommittee(),
        fetchDivisionHeads(),
        fetchSupervisors(),
        fetchSalesmanAssignments(),
        fetchTAApprovers(),
        fetchReferenceData()
      ]);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchExecutives, fetchReviewCommittee, fetchExpenseReviewCommittee, fetchDivisionHeads, fetchSupervisors, fetchSalesmanAssignments, fetchTAApprovers, fetchReferenceData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Mutations: each only refetches its affected table(s) ---
  const createExecutive = async (userId: number) => {
    try {
      await provider.createExecutive(userId);
      await fetchExecutives();
      toast.success("Executive assigned successfully");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign executive");
      throw err;
    }
  };

  const deleteExecutive = async (id: number) => {
    try {
      await provider.deleteExecutive(id);
      await fetchExecutives();
      toast.success("Executive removed successfully");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove executive");
      throw err;
    }
  };

  const createReviewCommittee = async (data: Partial<ReviewCommittee>) => {
    try {
      await provider.createReviewCommittee(data);
      await fetchReviewCommittee();
      toast.success("Review committee member added");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to add review committee member");
      throw err;
    }
  };

  const deleteReviewCommittee = async (id: number) => {
    try {
      await provider.deleteReviewCommittee(id);
      await fetchReviewCommittee();
      toast.success("Review committee member removed");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove review committee member");
      throw err;
    }
  };

  const createExpenseReviewCommittee = async (divisionId: number, userId: number, hierarchy: number) => {
    setIsLoading(true);
    try {
      await provider.createExpenseReviewCommittee({ division_id: divisionId, approver_id: userId, approver_heirarchy: hierarchy });
      // Small delay to ensure database consistency before refetch
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchExpenseReviewCommittee();
      toast.success("Expense review committee member assigned");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign expense review committee member");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteExpenseReviewCommittee = async (id: number) => {
    setIsLoading(true);
    try {
      await provider.deleteExpenseReviewCommittee(id);
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchExpenseReviewCommittee();
      toast.success("Expense review committee member removed");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove expense review committee member");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createDivisionHead = async (divisionId: number, userId: number) => {
    try {
      await provider.createDivisionHead(divisionId, userId);
      await fetchDivisionHeads();
      toast.success("Division head assigned");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign division head");
      throw err;
    }
  };

  const deleteDivisionHead = async (id: number) => {
    try {
      await provider.deleteDivisionHead(id);
      await fetchDivisionHeads();
      toast.success("Division head removed");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove division head");
      throw err;
    }
  };

  const createSupervisor = async (divisionId: number, supervisorId: number) => {
    try {
      await provider.createSupervisor(divisionId, supervisorId);
      await fetchSupervisors();
      toast.success("Supervisor assigned");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign supervisor");
      throw err;
    }
  };

  const deleteSupervisor = async (id: number) => {
    try {
      await provider.deleteSupervisor(id);
      // Cascade: supervisor delete also soft-deletes their salesmen, so refetch both
      await Promise.all([fetchSupervisors(), fetchSalesmanAssignments()]);
      toast.success("Supervisor removed (and linked salesmen unassigned)");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove supervisor");
      throw err;
    }
  };

  const createSalesmanAssignment = async (supDivId: number, salesmanId: number) => {
    try {
      await provider.createSalesmanAssignment(supDivId, salesmanId);
      await fetchSalesmanAssignments();
      toast.success("Salesman assigned successfully");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign salesman");
      throw err;
    }
  };

  const deleteSalesmanAssignment = async (id: number) => {
    try {
      await provider.deleteSalesmanAssignment(id);
      await fetchSalesmanAssignments();
      toast.success("Salesman unassigned successfully");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to unassign salesman");
      throw err;
    }
  };

  const createTAApprover = async (data: Partial<TAApprover>) => {
    try {
      await provider.createTAApprover(data);
      await fetchTAApprovers();
      toast.success("Time and Attendance approver assigned");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to assign TA approver");
      throw err;
    }
  };

  const deleteTAApprover = async (id: number) => {
    try {
      await provider.deleteTAApprover(id);
      await fetchTAApprovers();
      toast.success("Time and Attendance approver removed");
    } catch (e) {
      const err = e as Error;
      console.error(err);
      toast.error(err.message || "Failed to remove TA approver");
      throw err;
    }
  };

  return {
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
    departments,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    createExecutive,
    deleteExecutive,
    createReviewCommittee,
    deleteReviewCommittee,
    createExpenseReviewCommittee,
    deleteExpenseReviewCommittee,
    createDivisionHead,
    deleteDivisionHead,
    createSupervisor,
    deleteSupervisor,
    createSalesmanAssignment,
    deleteSalesmanAssignment,
    createTAApprover,
    deleteTAApprover
  };
}
