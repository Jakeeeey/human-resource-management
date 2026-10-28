"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  CompanyPermitData,
  CompanyPermitSummary,
  PermitFormData,
} from "../types/permit.types";

const defaultSummary: CompanyPermitSummary = {
  totalRequirements: 0,
  compliantCount: 0,
  expiringCount: 0,
  expiredCount: 0,
  missingCount: 0,
  complianceRate: 100,
};

export const useCompanyPermits = () => {
  const [data, setData] = useState<CompanyPermitData>({
    summary: defaultSummary,
    slots: [],
    allPermits: [],
    permitTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hrm/permit");
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to load company permits.");
      }
      setData(result.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Robust Filtered Slots matching UI tab keys: all, active, expiring, expired, no_record
  const filteredSlots = useMemo(() => {
    return data.slots.filter((slot) => {
      const typeName = (slot.permitType.name || slot.permitType.permit_type_name || "").toLowerCase();
      const permitNo = (slot.currentPermit?.permit_number || "").toLowerCase();
      const agency = (slot.currentPermit?.issuing_agency || "").toLowerCase();
      const notes = (slot.currentPermit?.notes || slot.currentPermit?.remarks || "").toLowerCase();
      const expiry = (slot.currentPermit?.expiry_date || slot.currentPermit?.expiration_date || "").toLowerCase();
      const term = searchTerm.trim().toLowerCase();

      // Search matching across typeName, permitNo, agency, notes, and expiry date
      if (
        term &&
        !typeName.includes(term) &&
        !permitNo.includes(term) &&
        !agency.includes(term) &&
        !notes.includes(term) &&
        !expiry.includes(term)
      ) {
        return false;
      }

      // Status matching
      if (statusFilter !== "all") {
        if (statusFilter === "active" || statusFilter === "compliant") {
          // Healthy or warning, but not expired, and must have a permit
          if (!slot.currentPermit || slot.currentPermit.health_level === "critical") {
            return false;
          }
        } else if (statusFilter === "expiring") {
          if (!slot.currentPermit || slot.currentPermit.health_level !== "warning") {
            return false;
          }
        } else if (statusFilter === "expired") {
          if (!slot.currentPermit || slot.currentPermit.health_level !== "critical") {
            return false;
          }
        } else if (statusFilter === "no_record" || statusFilter === "missing") {
          if (slot.currentPermit !== null) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data.slots, searchTerm, statusFilter]);

  const addPermit = async (payload: PermitFormData): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/hrm/permit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to add permit.");
      }
      toast.success(
        payload.renew_from_id
          ? "Permit successfully renewed!"
          : "Permit certificate added successfully!"
      );
      await fetchData();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add permit.";
      toast.error(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePermit = async (
    id: number | string,
    payload: Partial<PermitFormData>
  ): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hrm/permit/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to update permit.");
      }
      toast.success("Permit record updated successfully!");
      await fetchData();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update permit.";
      toast.error(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePermit = async (id: number | string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hrm/permit/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Failed to delete permit.");
      }
      toast.success("Permit deleted successfully!");
      await fetchData();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete permit.";
      toast.error(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    summary: data.summary,
    slots: filteredSlots,
    allSlotsCount: data.slots.length,
    permitTypes: data.permitTypes,
    isLoading,
    isSubmitting,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    refetch: fetchData,
    addPermit,
    updatePermit,
    deletePermit,
  };
};
