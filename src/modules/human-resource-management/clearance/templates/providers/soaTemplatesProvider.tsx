"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { useClearanceDirectory, type ClearanceDirectoryResource } from "../hooks/useClearanceDirectory";
import { useSoaTemplates, type SoaTemplatesResource } from "../hooks/useSoaTemplates";

export interface SoaTemplatesFetchContextValue {
    templates: SoaTemplatesResource;
    directory: ClearanceDirectoryResource;
    showInactive: boolean;
    setShowInactive: (value: boolean) => void;
}

const SoaTemplatesFetchContext = createContext<SoaTemplatesFetchContextValue | undefined>(undefined);

export function SoaTemplatesFetchProvider({ children }: { children: ReactNode }): ReactNode {
    const [showInactive, setShowInactive] = useState(false);
    const templates = useSoaTemplates(showInactive);
    const directory = useClearanceDirectory();

    const value = useMemo(
        () => ({ templates, directory, showInactive, setShowInactive }),
        [templates, directory, showInactive]
    );

    return <SoaTemplatesFetchContext.Provider value={value}>{children}</SoaTemplatesFetchContext.Provider>;
}

export function useSoaTemplatesFetch(): SoaTemplatesFetchContextValue {
    const context = useContext(SoaTemplatesFetchContext);
    if (context === undefined) {
        throw new Error("useSoaTemplatesFetch must be used inside SoaTemplatesFetchProvider");
    }
    return context;
}
