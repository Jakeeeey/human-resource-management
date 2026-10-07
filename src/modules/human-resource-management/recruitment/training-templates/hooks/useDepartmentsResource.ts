"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listDepartments } from "@/modules/human-resource-management/employee-admin/employee-masterlist/providers/fetchProvider";

import type { DepartmentOption } from "../types/training-templates.schema";

// useDepartmentsResource.ts — the department list the template selector needs,
// fetched through the existing employee-masterlist proxy helper (the same path
// other modules use; not reinvented here). Loaded once on mount; a failure is a
// quiet empty option list because the selector still supports the global
// template.

export interface DepartmentsResource {
  rows: DepartmentOption[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Client state for the department selector options.
 * @returns Department options plus loading/error flags.
 */
export function useDepartmentsResource(): DepartmentsResource {
  const [rows, setRows] = useState<DepartmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setError(null);
      const list = await listDepartments();
      setRows(
        list
          .map((department) => ({
            department_id: department.department_id,
            department_name: department.department_name,
          }))
          .sort((a, b) => a.department_name.localeCompare(b.department_name))
      );
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return useMemo(
    () => ({ rows, isLoading, isError, error, refetch }),
    [rows, isLoading, isError, error, refetch]
  );
}
