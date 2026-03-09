"use client";

import { useCompanyProfileContext } from "../providers/CompanyProfileProvider";

/**
 * useCompanyProfile Hook
 * Consumer of CompanyProfileContext to provide shared state and actions.
 */
export function useCompanyProfile() {
    return useCompanyProfileContext();
}
