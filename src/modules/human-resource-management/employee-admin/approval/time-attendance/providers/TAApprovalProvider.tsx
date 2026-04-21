"use client";

import React, { createContext, useContext } from "react";

const TAApprovalContext = createContext<unknown>(null);

export function TAApprovalProvider({ children }: { children: React.ReactNode }) {
  return (
    <TAApprovalContext.Provider value={{}}>
      {children}
    </TAApprovalContext.Provider>
  );
}

export const useTAApprovalContext = () => useContext(TAApprovalContext);
