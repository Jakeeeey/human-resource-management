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

  // --- Granular Fetch Functions ---

  const fetchExecutives = useCallback(async () => {
    try {
      const data = await provider.listExecutives();
      setExecutives(data);
    } catch (err) {
      console.error("Failed to fetch executives", err);
    }
  }, []);

  const fetchReviewCommittee = useCallback(async () => {
    try {
      const data = await provider.listReviewCommittee();
      setReviewCommittee(data);
    } catch (err) {
      console.error("Failed to fetch review committee", err);
    }
  }, []);

  const fetchDivisionHeads = useCallback(async () => {
    try {
      const data = await provider.listDivisionHeads();
      setDivisionHeads(data);
    } catch (err) {
      console.error("Failed to fetch division heads", err);
    }
  }, []);

  const fetchSupervisors = useCallback(async () => {
    try {
      const data = await provider.listSupervisors();
      setSupervisors(data);
    } catch (err) {
      console.error("Failed to fetch supervisors", err);
    }
  }, []);

  const fetchSalesmanAssignments = useCallback(async () => {
    try {
      const data = await provider.listSalesmanAssignments();
      setSalesmanAssignments(data);
    } catch (err) {
      console.error("Failed to fetch salesman assignments", err);
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    try {
      const [u, d, s] = await Promise.all([
        provider.listUsers(),
        provider.listDivisions(),
        provider.listSalesmen()
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

  // --- Mutations with Granular Refetch ---

  const createExecutive = async (userId: number) => {
    try {
      await provider.createExecutive(userId);
      await fetchExecutives(); // Only refetch executives
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
      await fetchExecutives(); // Only refetch executives
      toast.success("Executive removed successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove executive");
      throw err;
    }
  };

  const createReviewCommittee = async (payload: Partial<ReviewCommittee>) => {
    try {
      await provider.createReviewCommittee(payload);
      await fetchReviewCommittee(); // Only refetch review committee
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
      await fetchReviewCommittee(); // Only refetch review committee
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
      await fetchDivisionHeads(); // Only refetch division heads
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
      await fetchDivisionHeads(); // Only refetch division heads
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
      await fetchSupervisors(); // Only refetch supervisors
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
      // Supervisor delete cascades to assignments, so fetch both
      await Promise.all([
        fetchSupervisors(),
        fetchSalesmanAssignments()
      ]);
      toast.success("Supervisor removed (and linked salesmen unassigned)");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove supervisor");
      throw err;
    }
  };

  const createSalesmanAssignment = async (supervisorPerDivisionId: number, salesmanId: number) => {
    try {
      await provider.createSalesmanAssignment(supervisorPerDivisionId, salesmanId);
      await fetchSalesmanAssignments(); // Only refetch assignments
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
      await fetchSalesmanAssignments(); // Only refetch assignments
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
