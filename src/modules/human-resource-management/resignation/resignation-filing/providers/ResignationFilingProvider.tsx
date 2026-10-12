"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { EnrichedResignationRequest, ResignationForm } from "../types";
import type { ResignationEligibility } from "../cooldown";

const API_PATH = "/api/hrm/resignation/resignation-filing";
const UPLOAD_PATH = "/api/hrm/resignation/resignation-filing/upload";

export interface ResignationFilingSubmitResult {
    ok: boolean;
    fieldErrors: Record<string, string>;
}

export interface ResignationAttachmentRef {
    id: string;
    name: string;
    fileType: string;
}

interface FilingIssue {
    path: Array<string | number>;
    message: string;
}

interface FilingErrorBody {
    error?: string;
    message?: string;
    issues?: FilingIssue[];
    eligibility?: ResignationEligibility;
}

interface FilingListBody {
    data?: EnrichedResignationRequest[];
    eligibility?: ResignationEligibility;
    total?: number;
}

interface UploadBody {
    success?: boolean;
    message?: string;
    data?: { id?: string };
}

interface ResignationFilingContextType {
    filings: EnrichedResignationRequest[];
    eligibility: ResignationEligibility | null;
    total: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    submitFiling: (form: ResignationForm) => Promise<ResignationFilingSubmitResult>;
    withdrawFiling: (id: number) => Promise<boolean>;
    uploadAttachment: (file: File) => Promise<ResignationAttachmentRef | null>;
}

const ResignationFilingContext = createContext<ResignationFilingContextType | undefined>(undefined);

async function readErrorBody(response: Response): Promise<FilingErrorBody> {
    try {
        const parsed = (await response.json()) as FilingErrorBody;
        return parsed ?? {};
    } catch {
        return {};
    }
}

function toFieldErrors(issues: FilingIssue[] | undefined): Record<string, string> {
    const fieldErrors: Record<string, string> = {};
    if (!issues) {
        return fieldErrors;
    }
    for (const issue of issues) {
        const key = issue.path.length > 0 ? String(issue.path[0]) : "reason";
        if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
        }
    }
    return fieldErrors;
}

export function ResignationFilingProvider({ children }: { children: React.ReactNode }) {
    const [filings, setFilings] = useState<EnrichedResignationRequest[]>([]);
    const [eligibility, setEligibility] = useState<ResignationEligibility | null>(null);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(API_PATH, { cache: "no-store" });
            if (!response.ok) {
                const errBody = await readErrorBody(response);
                throw new Error(errBody.error || "Failed to load resignation filings");
            }
            const result = (await response.json()) as FilingListBody;
            setFilings(Array.isArray(result.data) ? result.data : []);
            setTotal(typeof result.total === "number" ? result.total : 0);
            setEligibility(result.eligibility ?? null);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load resignation filings";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const submitFiling = useCallback(
        async (form: ResignationForm): Promise<ResignationFilingSubmitResult> => {
            try {
                const response = await fetch(API_PATH, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                if (!response.ok) {
                    const errBody = await readErrorBody(response);
                    if (errBody.eligibility) {
                        setEligibility(errBody.eligibility);
                    }
                    const message = errBody.error || "Failed to submit resignation";
                    toast.error(message);
                    return { ok: false, fieldErrors: toFieldErrors(errBody.issues) };
                }
                toast.success("Resignation filed successfully");
                await refresh();
                return { ok: true, fieldErrors: {} };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to submit resignation";
                toast.error(message);
                return { ok: false, fieldErrors: {} };
            }
        },
        [refresh]
    );

    const withdrawFiling = useCallback(
        async (id: number): Promise<boolean> => {
            try {
                const response = await fetch(`${API_PATH}/${id}/withdraw`, { method: "PATCH" });
                if (!response.ok) {
                    const errBody = await readErrorBody(response);
                    throw new Error(errBody.error || "Failed to withdraw resignation filing");
                }
                toast.success("Resignation filing withdrawn");
                await refresh();
                return true;
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to withdraw resignation filing");
                return false;
            }
        },
        [refresh]
    );

    const uploadAttachment = useCallback(async (file: File): Promise<ResignationAttachmentRef | null> => {
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch(UPLOAD_PATH, { method: "POST", body: formData });
            const result = (await response.json().catch(() => null)) as UploadBody | null;
            if (!response.ok || !result || result.success !== true || !result.data?.id) {
                throw new Error(result?.message || "Failed to upload attachment");
            }
            return { id: result.data.id, name: file.name, fileType: file.type };
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to upload attachment");
            return null;
        }
    }, []);

    const contextValue = useMemo(
        () => ({
            filings,
            eligibility,
            total,
            isLoading,
            error,
            refresh,
            submitFiling,
            withdrawFiling,
            uploadAttachment,
        }),
        [filings, eligibility, total, isLoading, error, refresh, submitFiling, withdrawFiling, uploadAttachment]
    );

    return <ResignationFilingContext.Provider value={contextValue}>{children}</ResignationFilingContext.Provider>;
}

export function useResignationFilingContext() {
    const context = useContext(ResignationFilingContext);
    if (context === undefined) {
        throw new Error("useResignationFilingContext must be used within a ResignationFilingProvider");
    }
    return context;
}
