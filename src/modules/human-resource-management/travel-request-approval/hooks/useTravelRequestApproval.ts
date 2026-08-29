import { useState, useCallback } from "react";
import { TravelRequest, TravelRequestApprovalPayload } from "../types/schema";

export function useTravelRequestApproval() {
  const [data, setData] = useState<TravelRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/hrm/travel-request-approval?t=${Date.now()}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to fetch travel requests");
      }
      setData(result.data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approveRequest = async (id: number | string, remarks?: string) => {
    try {
      const payload: TravelRequestApprovalPayload = { status: "approved", approval_remarks: remarks };
      const response = await fetch(`/api/hrm/travel-request-approval/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Failed to approve request");
      }
      await fetchRequests(); // Refresh the list
    } catch (err: unknown) {
      throw err;
    }
  };

  const rejectRequest = async (id: number | string, remarks?: string) => {
    try {
      const payload: TravelRequestApprovalPayload = { status: "rejected", approval_remarks: remarks };
      const response = await fetch(`/api/hrm/travel-request-approval/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "Failed to reject request");
      }
      await fetchRequests(); // Refresh the list
    } catch (err: unknown) {
      throw err;
    }
  };

  return {
    data,
    isLoading,
    error,
    refresh: fetchRequests,
    approveRequest,
    rejectRequest,
  };
}
