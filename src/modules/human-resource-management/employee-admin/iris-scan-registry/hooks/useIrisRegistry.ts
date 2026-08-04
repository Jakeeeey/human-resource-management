/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useCallback, useEffect } from "react";
import * as provider from "../../employee-masterlist/providers/fetchProvider";
import { User, Department } from "../../employee-masterlist/types";
import { toast } from "sonner";

export function useIrisRegistry() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await provider.listEmployees();
      
      const activeEmployees = data.filter(emp => {
        const val = emp.isDeleted ?? (emp as unknown as Record<string, unknown>).is_deleted ?? (emp as unknown as Record<string, unknown>).deleted;
        if (val === undefined || val === null) return true;
        
        if (typeof val === 'object' && 'data' in val && Array.isArray(val.data)) {
          return val.data[0] === 0;
        }
        if (typeof val === 'string') {
          const s = val.toLowerCase();
          return s !== '1' && s !== 'true';
        }
        return !val;
      });
      
      setEmployees(activeEmployees);
    } catch (err) {
      throw err;
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await provider.listDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      await Promise.all([fetchEmployees(), fetchDepartments()]);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchEmployees, fetchDepartments]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalRegistered = employees.filter(e => !!e.biometricId).length;
  const totalPending = employees.length - totalRegistered;

  return {
    employees,
    departments,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    totalRegistered,
    totalPending
  };
}
