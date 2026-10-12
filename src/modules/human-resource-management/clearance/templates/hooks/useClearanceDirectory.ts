"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    listDirectoryDepartments,
    listDirectoryEmployees,
    type DirectoryDepartment,
    type DirectoryEmployee,
} from "../providers/clearanceDirectoryClient";

export interface ClearanceDirectoryResource {
    departments: DirectoryDepartment[];
    employees: DirectoryEmployee[];
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    departmentName: (id: number) => string;
    employeeName: (id: number) => string;
}

export function useClearanceDirectory(): ClearanceDirectoryResource {
    const [departments, setDepartments] = useState<DirectoryDepartment[]>([]);
    const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setIsError(false);
            setError(null);
            const [departmentResult, employeeResult] = await Promise.allSettled([
                listDirectoryDepartments(),
                listDirectoryEmployees(),
            ]);
            if (departmentResult.status === "fulfilled") {
                setDepartments(departmentResult.value);
            }
            if (employeeResult.status === "fulfilled") {
                setEmployees(employeeResult.value);
            }
            const rejection =
                departmentResult.status === "rejected"
                    ? departmentResult.reason
                    : employeeResult.status === "rejected"
                        ? employeeResult.reason
                        : null;
            if (rejection !== null) {
                setIsError(true);
                setError(rejection instanceof Error ? rejection : new Error(String(rejection)));
            }
        } catch (err) {
            setIsError(true);
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const departmentName = useCallback(
        (id: number) => departments.find((department) => department.id === id)?.name ?? "Unknown department",
        [departments]
    );

    const employeeName = useCallback(
        (id: number) => employees.find((employee) => employee.id === id)?.fullName ?? "Unknown employee",
        [employees]
    );

    return useMemo(
        () => ({ departments, employees, isLoading, isError, error, refresh, departmentName, employeeName }),
        [departments, employees, isLoading, isError, error, refresh, departmentName, employeeName]
    );
}
