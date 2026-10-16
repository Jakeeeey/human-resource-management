"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { EnrichedResignationRequest, ResignationEmployeeOption, ResignationForm } from "../types";
import type { ResignationEligibility } from "../cooldown";

const API_PATH = "/api/hrm/resignation/resignation-filing";
const EMPLOYEES_PATH = "/api/hrm/resignation/resignation-filing/employees";
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

interface EmployeeListBody {
    data?: ResignationEmployeeOption[];
}

interface UploadBody {
    success?: boolean;
    message?: string;
    data?: { id?: string };
}

interface ResignationFilingContextType {
    employees: ResignationEmployeeOption[];
    isLoadingEmployees: boolean;
    employeesError: string | null;
    selectedUserId: number | null;
    selectedEmployee: ResignationEmployeeOption | null;
    selectEmployee: (userId: number | null) => void;
    filings: EnrichedResignationRequest[];
    eligibility: ResignationEligibility | null;
    total: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    submitFiling: (form: ResignationForm) => Promise<ResignationFilingSubmitResult>;
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
    const [employees, setEmployees] = useState<ResignationEmployeeOption[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
    const [employeesError, setEmployeesError] = useState<string | null>(null);
    const [employeesToken, setEmployeesToken] = useState(0);

    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [filings, setFilings] = useState<EnrichedResignationRequest[]>([]);
    const [eligibility, setEligibility] = useState<ResignationEligibility | null>(null);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filingsToken, setFilingsToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setIsLoadingEmployees(true);
        setEmployeesError(null);
        fetch(EMPLOYEES_PATH, { cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) {
                    const errBody = await readErrorBody(response);
                    throw new Error(errBody.error || "Failed to load employees");
                }
                return (await response.json()) as EmployeeListBody;
            })
            .then((result) => {
                if (cancelled) {
                    return;
                }
                setEmployees(Array.isArray(result.data) ? result.data : []);
            })
            .catch((err: unknown) => {
                if (cancelled) {
                    return;
                }
                const message = err instanceof Error ? err.message : "Failed to load employees";
                setEmployees([]);
                setEmployeesError(message);
                toast.error(message);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoadingEmployees(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [employeesToken]);

    useEffect(() => {
        if (selectedUserId === null) {
            setFilings([]);
            setEligibility(null);
            setTotal(0);
            setError(null);
            setIsLoading(false);
            return;
        }
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        const load = async () => {
            try {
                const response = await fetch(`${API_PATH}?user_id=${selectedUserId}`, { cache: "no-store" });
                if (!response.ok) {
                    const errBody = await readErrorBody(response);
                    throw new Error(errBody.error || "Failed to load resignation filings");
                }
                const result = (await response.json()) as FilingListBody;
                if (cancelled) {
                    return;
                }
                setFilings(Array.isArray(result.data) ? result.data : []);
                setTotal(typeof result.total === "number" ? result.total : 0);
                setEligibility(result.eligibility ?? null);
            } catch (err) {
                if (cancelled) {
                    return;
                }
                const message = err instanceof Error ? err.message : "Failed to load resignation filings";
                setError(message);
                toast.error(message);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [selectedUserId, filingsToken]);

    const selectEmployee = useCallback((userId: number | null) => {
        setSelectedUserId(userId);
    }, []);

    const refresh = useCallback(async () => {
        setEmployeesToken((value) => value + 1);
        if (selectedUserId !== null) {
            setFilingsToken((value) => value + 1);
        }
    }, [selectedUserId]);

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
                const employeeName = employees.find((employee) => employee.user_id === form.user_id)?.full_name;
                toast.success(employeeName ? `Resignation filed for ${employeeName}` : "Resignation filed");
                setFilingsToken((value) => value + 1);
                return { ok: true, fieldErrors: {} };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to submit resignation";
                toast.error(message);
                return { ok: false, fieldErrors: {} };
            }
        },
        [employees]
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

    const selectedEmployee = useMemo(
        () => employees.find((employee) => employee.user_id === selectedUserId) ?? null,
        [employees, selectedUserId]
    );

    const contextValue = useMemo(
        () => ({
            employees,
            isLoadingEmployees,
            employeesError,
            selectedUserId,
            selectedEmployee,
            selectEmployee,
            filings,
            eligibility,
            total,
            isLoading,
            error,
            refresh,
            submitFiling,
            uploadAttachment,
        }),
        [
            employees,
            isLoadingEmployees,
            employeesError,
            selectedUserId,
            selectedEmployee,
            selectEmployee,
            filings,
            eligibility,
            total,
            isLoading,
            error,
            refresh,
            submitFiling,
            uploadAttachment,
        ]
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
