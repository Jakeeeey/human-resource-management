"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useCampaigns, type UseCampaignsResult } from "../hooks/useCampaigns";

const CampaignsContext = createContext<UseCampaignsResult | null>(null);

export function CampaignsProvider({ children }: { children: ReactNode }) {
    const value = useCampaigns();
    return <CampaignsContext.Provider value={value}>{children}</CampaignsContext.Provider>;
}

export function useCampaignsContext(): UseCampaignsResult {
    const ctx = useContext(CampaignsContext);
    if (!ctx) throw new Error("CampaignsProvider is missing.");
    return ctx;
}
