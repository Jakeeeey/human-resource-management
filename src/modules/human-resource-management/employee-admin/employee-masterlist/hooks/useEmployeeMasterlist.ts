"use client";

import { useState, useCallback, useEffect } from "react";
import * as provider from "../providers/fetchProvider";
import * as spring from "../providers/springProvider";
import { User, Department } from "../types";
import { toast } from "sonner";

export function useEmployeeMasterlist() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await provider.listEmployees();
      
      // Broadened filtering logic for soft-deleted employees.
      // Handles: isDeleted, is_deleted, deleted
      // Types: Boolean, String ("1", "true"), Number (1, 0), Buffer/Object from DB
      const activeEmployees = data.filter(emp => {
        const val = emp.isDeleted ?? (emp as unknown as Record<string, unknown>).is_deleted ?? (emp as unknown as Record<string, unknown>).deleted;
        if (val === undefined || val === null) return true; // Keep if flag is missing
        
        // 1. Handle standard Buffer/Object from DB: { type: "Buffer", data: [1] }
        if (typeof val === 'object' && 'data' in val && Array.isArray(val.data)) {
          return val.data[0] === 0;
        }
        
        // 2. Handle Strings: "1", "0", "true", "false"
        if (typeof val === 'string') {
          const s = val.toLowerCase();
          return s !== '1' && s !== 'true';
        }
        
        // 3. Handle Number/Boolean: 1/0, true/false
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

  const removeEmployee = async (id: number) => {
    try {
      await spring.deleteEmployeeSpring(id);
      await fetchEmployees();
      toast.success("Employee record deleted successfully");
    } catch (e) {
      const err = e as Error;
      // If the error message contains 404, it likely means the record is already gone.
      // We should refresh the list anyway to clear the table.
      if (err.message.includes("404")) {
        await fetchEmployees();
        toast.info("Registry updated. Record was already deleted or not found.");
        return;
      }
      toast.error(err.message || "Failed to delete employee");
      throw err;
    }
  };

  const addEmployee = async (data: Record<string, unknown>) => {
    try {
      await provider.createEmployee(data);
      await fetchEmployees();
      toast.success("Employee added successfully");
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to add employee");
      throw err;
    }
  };

  const updateEmployee = async (id: number, data: spring.UpdateEmployeePayload) => {
    try {
      await spring.updateEmployeeSpring(id, data);
      await fetchEmployees();
      toast.success("Employee updated successfully");
    } catch (e) {
      const err = e as Error;
      toast.error(err.message || "Failed to update employee");
      throw err;
    }
  };

  return {
    employees,
    departments,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    removeEmployee,
    addEmployee,
    updateEmployee,
  };
}
