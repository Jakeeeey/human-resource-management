import { useState, useCallback, useEffect } from "react";
import { fetchOvertimeTopsheet } from "../providers/fetchProvider";
import type { TopsheetUserSummary } from "../type";
import { toast } from "sonner";
import { format } from "date-fns";

export function useOvertimeTopsheet() {
  const [data, setData] = useState<TopsheetUserSummary[]>([]);
  const [departments, setDepartments] = useState<{ department_id: number; department_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  const [departmentId, setDepartmentId] = useState<string>("all");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const startStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined;
      const endStr = dateTo ? format(dateTo, "yyyy-MM-dd") : undefined;

      const response = await fetchOvertimeTopsheet(startStr, endStr, departmentId);
      setData(response.data);
      if (response.departments) {
        setDepartments(response.departments);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load overtime topsheet";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, departmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    departments,
    isLoading,
    error,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    departmentId,
    setDepartmentId,
    refresh: loadData
  };
}
