"use client";

import { useState, useCallback, useEffect } from "react";
import * as provider from "../providers/fetchProvider";
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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [ex, rc, dh, sup, sa, u, d, s] = await Promise.all([
        provider.listExecutives(),
        provider.listReviewCommittee(),
        provider.listDivisionHeads(),
        provider.listSupervisors(),
        provider.listSalesmanAssignments(),
        provider.listUsers(),
        provider.listDivisions(),
        provider.listSalesmen()
      ]);

      setExecutives(ex);
      setReviewCommittee(rc);
      setDivisionHeads(dh);
      setSupervisors(sup);
      setSalesmanAssignments(sa);
      setUsers(u);
      setDivisions(d);
      setSalesmen(s);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Mutations
  const createExecutive = async (userId: number) => {
    await provider.createExecutive(userId);
    await fetchData();
  };

  const deleteExecutive = async (id: number) => {
    await provider.deleteExecutive(id);
    await fetchData();
  };

  const createReviewCommittee = async (data: Partial<ReviewCommittee>) => {
    await provider.createReviewCommittee(data);
    await fetchData();
  };

  const deleteReviewCommittee = async (id: number) => {
    await provider.deleteReviewCommittee(id);
    await fetchData();
  };

  const createDivisionHead = async (divisionId: number, userId: number) => {
    await provider.createDivisionHead(divisionId, userId);
    await fetchData();
  };

  const deleteDivisionHead = async (id: number) => {
    await provider.deleteDivisionHead(id);
    await fetchData();
  };

  const createSupervisor = async (divisionId: number, supervisorId: number) => {
    await provider.createSupervisor(divisionId, supervisorId);
    await fetchData();
  };

  const deleteSupervisor = async (id: number) => {
    await provider.deleteSupervisor(id);
    await fetchData();
  };

  const createSalesmanAssignment = async (supDivId: number, salesmanId: number) => {
    await provider.createSalesmanAssignment(supDivId, salesmanId);
    await fetchData();
  };

  const deleteSalesmanAssignment = async (id: number) => {
    await provider.deleteSalesmanAssignment(id);
    await fetchData();
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
    deleteSalesmanAssignment,
  };
}
