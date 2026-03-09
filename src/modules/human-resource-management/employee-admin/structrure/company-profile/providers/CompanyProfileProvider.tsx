"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CompanyProfile } from "../types/company-profile.schema";
import { toastServerDown } from "@/modules/human-resource-management/employee-admin/administrator/utils/utils";
import { toast } from "sonner";

interface CompanyProfileContextType {
    data: CompanyProfile | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    updateProfile: (profile: Partial<CompanyProfile>) => Promise<boolean>;
    uploadLogo: (file: File) => Promise<string | null>;
}

const CompanyProfileContext = createContext<CompanyProfileContextType | undefined>(undefined);

export function CompanyProfileProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<CompanyProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/hrm/employee-admin/structure/company-profile");
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to fetch company profile");
            }
            const result = await response.json();
            setData(result.data);
        } catch (err) {
            const error = err as Error;
            setError(error.message);
            toastServerDown(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const updateProfile = async (profile: Partial<CompanyProfile>) => {
        try {
            const response = await fetch("/api/hrm/employee-admin/structure/company-profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...profile, company_id: data?.company_id }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to update profile");
            }
            toast.success("Company profile updated successfully");
            refresh();
            return true;
        } catch (err) {
            toastServerDown(err as Error);
            return false;
        }
    };

    const uploadLogo = async (file: File) => {
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/hrm/employee-admin/structure/company-profile/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to upload logo");
            }

            const result = await response.json();
            // Store only the file ID (UUID) in the database
            return result.data.id;
        } catch (err) {
            toastServerDown(err as Error);
            return null;
        }
    };

    return (
        <CompanyProfileContext.Provider value={{
            data,
            isLoading,
            error,
            refresh,
            updateProfile,
            uploadLogo,
        }}>
            {children}
        </CompanyProfileContext.Provider>
    );
}

export function useCompanyProfileContext() {
    const context = useContext(CompanyProfileContext);
    if (context === undefined) {
        throw new Error("useCompanyProfileContext must be used within a CompanyProfileProvider");
    }
    return context;
}
