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
  SystemUser,
  Division,
  Salesman
} from "../types";

export function useRoleManagement() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [reviewCommittee, setReviewCommittee] = useState<ReviewCommittee[]>([]);
  const [divisionHeads, setDivisionHeads] = useState<DivisionSalesHead[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorPerDivision[]>([]);
  const [salesmanAssignments, setSalesmanAssignments] = useState<SalesmanPerSupervisor[]>([]);

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);

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

  const fetchSupervisors = useCallback(async () => {
    const sup = await provider.listSupervisors();
    setSupervisors(sup);
  }, []);

  const fetchSalesmanAssignments = useCallback(async () => {
    const sa = await provider.listSalesmanAssignments();
    setSalesmanAssignments(sa);
  }, []);



  const fetchReferenceData = useCallback(async () => {
    try {
      const [u, d, s] = await Promise.all([
        provider.listUsers(),
        provider.listDivisions(),
        provider.listSalesmen(),
      ]);
      setUsers(u);
      setDivisions(d);
      setSalesmen(s);
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
        fetchDivisionHeads(),
        fetchSupervisors(),
        fetchSalesmanAssignments(),
        fetchReferenceData()
      ]);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchExecutives, fetchReviewCommittee, fetchDivisionHeads, fetchSupervisors, fetchSalesmanAssignments, fetchReferenceData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Mutations: each only refetches its affected table(s) ---
  const createExecutive = async (userId: number) => {
    try {
      await provider.createExecutive(userId);
      await fetchExecutives();
      toast.success("Executive assigned successfully");
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove review committee member");
      throw err;
    }
  };

  const createDivisionHead = async (divisionId: number, userId: number) => {
    try {
      await provider.createDivisionHead(divisionId, userId);
      await fetchDivisionHeads();
      toast.success("Division head assigned");
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to unassign salesman");
      throw err;
    }
  };

  return {
    executives,
    reviewCommittee,
    divisionHeads,
    supervisors,
    salesmanAssignments,
    users,
    divisions,
    salesmen,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    createExecutive,
    deleteExecutive,
    createReviewCommittee,
    deleteReviewCommittee,
    createDivisionHead,
    deleteDivisionHead,
    createSupervisor,
    deleteSupervisor,
    createSalesmanAssignment,
    deleteSalesmanAssignment
  };
}
