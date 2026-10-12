"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { useClearanceDirectory, type ClearanceDirectoryResource } from "../hooks/useClearanceDirectory";
import { useClearanceTemplates, type ClearanceTemplatesResource } from "../hooks/useClearanceTemplates";

export interface ClearanceTemplatesFetchContextValue {
    templates: ClearanceTemplatesResource;
    directory: ClearanceDirectoryResource;
    showInactive: boolean;
    setShowInactive: (value: boolean) => void;
}

const ClearanceTemplatesFetchContext = createContext<ClearanceTemplatesFetchContextValue | undefined>(undefined);

export function ClearanceTemplatesFetchProvider({ children }: { children: ReactNode }): ReactNode {
    const [showInactive, setShowInactive] = useState(false);
    const templates = useClearanceTemplates(showInactive);
    const directory = useClearanceDirectory();

    const value = useMemo(
        () => ({ templates, directory, showInactive, setShowInactive }),
        [templates, directory, showInactive]
    );

    return <ClearanceTemplatesFetchContext.Provider value={value}>{children}</ClearanceTemplatesFetchContext.Provider>;
}

export function useClearanceTemplatesFetch(): ClearanceTemplatesFetchContextValue {
    const context = useContext(ClearanceTemplatesFetchContext);
    if (context === undefined) {
        throw new Error("useClearanceTemplatesFetch must be used inside ClearanceTemplatesFetchProvider");
    }
    return context;
}
