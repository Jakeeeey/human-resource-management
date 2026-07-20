import { useState, useCallback, useEffect } from "react";
import * as empProvider from "../../employee-masterlist/providers/fetchProvider";
import { fetchAllFaceBiometrics } from "../providers/fetchProvider";
import { User, Department, FaceBiometricRecord } from "../types";

export function useFaceRegistry() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faceBiometrics, setFaceBiometrics] = useState<FaceBiometricRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await empProvider.listEmployees();
      
      const activeEmployees = data.filter(emp => {
        const val = emp.isDeleted ?? (emp as unknown as Record<string, unknown>).is_deleted ?? (emp as unknown as Record<string, unknown>).deleted;
        if (val === undefined || val === null) return true;
        
        if (typeof val === 'object' && val !== null && 'data' in val && Array.isArray(val.data)) {
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
      const data = await empProvider.listDepartments();
      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments", err);
    }
  }, []);

  const fetchBiometrics = useCallback(async () => {
    try {
      const data = await fetchAllFaceBiometrics();
      setFaceBiometrics(data);
    } catch (err) {
      console.error("Failed to fetch face biometrics", err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      await Promise.all([fetchEmployees(), fetchDepartments(), fetchBiometrics()]);
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error("Failed to fetch data"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchEmployees, fetchDepartments, fetchBiometrics]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Extend employees with biometric status
  const employeesWithFace = employees.map(emp => {
    const activeBiometric = faceBiometrics.find(fb => fb.user_id === emp.id && fb.is_active);
    return {
      ...emp,
      hasFaceBiometric: !!activeBiometric,
      image_reference_path: activeBiometric?.image_reference_path || null
    };
  });

  const totalRegistered = employeesWithFace.filter(e => e.hasFaceBiometric).length;
  const totalPending = employeesWithFace.length - totalRegistered;

  return {
    employees: employeesWithFace,
    departments,
    isLoading,
    isError,
    error,
    refetch: fetchData,
    totalRegistered,
    totalPending
  };
}
