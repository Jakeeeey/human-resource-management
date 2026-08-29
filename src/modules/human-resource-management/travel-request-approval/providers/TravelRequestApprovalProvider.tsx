"use client";

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useTravelRequestApproval } from "../hooks/useTravelRequestApproval";
import { TravelRequest } from "../types/schema";

interface TravelRequestApprovalContextType {
  data: TravelRequest[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  approveRequest: (id: number | string, remarks?: string) => Promise<void>;
  rejectRequest: (id: number | string, remarks?: string) => Promise<void>;
}

const TravelRequestApprovalContext = createContext<TravelRequestApprovalContextType | undefined>(undefined);

export function TravelRequestApprovalProvider({ children }: { children: ReactNode }) {
  const travelRequestApproval = useTravelRequestApproval();

  useEffect(() => {
    travelRequestApproval.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TravelRequestApprovalContext.Provider value={travelRequestApproval}>
      {children}
    </TravelRequestApprovalContext.Provider>
  );
}

export function useTravelRequestApprovalContext() {
  const context = useContext(TravelRequestApprovalContext);
  if (context === undefined) {
    throw new Error("useTravelRequestApprovalContext must be used within a TravelRequestApprovalProvider");
  }
  return context;
}
