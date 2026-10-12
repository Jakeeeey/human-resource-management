"use client";

import { useState } from "react";
import { useResignationFilingContext } from "../providers/ResignationFilingProvider";
import type { EnrichedResignationRequest } from "../types";

export function useResignationFiling() {
    const context = useResignationFilingContext();
    const [previewFiling, setPreviewFiling] = useState<EnrichedResignationRequest | null>(null);
    const [withdrawTarget, setWithdrawTarget] = useState<EnrichedResignationRequest | null>(null);
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const openPreview = (filing: EnrichedResignationRequest) => {
        setPreviewFiling(filing);
    };

    const closePreview = () => {
        setPreviewFiling(null);
    };

    const requestWithdraw = (filing: EnrichedResignationRequest) => {
        setWithdrawTarget(filing);
    };

    const cancelWithdraw = () => {
        setWithdrawTarget(null);
    };

    const confirmWithdraw = async (): Promise<void> => {
        if (withdrawTarget === null || typeof withdrawTarget.id !== "number") {
            setWithdrawTarget(null);
            return;
        }
        setIsWithdrawing(true);
        const ok = await context.withdrawFiling(withdrawTarget.id);
        setIsWithdrawing(false);
        if (ok) {
            setWithdrawTarget(null);
        }
    };

    return {
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
        withdrawTarget,
        requestWithdraw,
        cancelWithdraw,
        confirmWithdraw,
        isWithdrawing,
    };
}
