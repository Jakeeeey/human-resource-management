"use client";

import { useState } from "react";
import { useResignationFilingContext } from "../providers/ResignationFilingProvider";
import type { EnrichedResignationRequest } from "../types";

export function useResignationFiling() {
    const context = useResignationFilingContext();
    const [previewFiling, setPreviewFiling] = useState<EnrichedResignationRequest | null>(null);

    const openPreview = (filing: EnrichedResignationRequest) => {
        setPreviewFiling(filing);
    };

    const closePreview = () => {
        setPreviewFiling(null);
    };

    return {
        employees: context.employees,
        isLoadingEmployees: context.isLoadingEmployees,
        employeesError: context.employeesError,
        selectedUserId: context.selectedUserId,
        selectedEmployee: context.selectedEmployee,
        selectEmployee: context.selectEmployee,
        filings: context.filings,
        eligibility: context.eligibility,
        total: context.total,
        isLoading: context.isLoading,
        error: context.error,
        refresh: context.refresh,
        submitFiling: context.submitFiling,
        uploadAttachment: context.uploadAttachment,
        previewFiling,
        openPreview,
        closePreview,
    };
}
