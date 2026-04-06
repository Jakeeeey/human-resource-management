"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { PdfConfig, CompanyData, PdfTemplate } from "../types";
import { DEFAULT_CONFIG } from "@/components/pdf-layout-design/constants";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import { getPdfBlobUrl } from "@/components/pdf-layout-design/PdfGenerator";
import { toast } from "sonner";
import { Undo, Redo } from "lucide-react";

interface PdfLayoutFetchContextType {
    config: PdfConfig;
    setConfig: React.Dispatch<React.SetStateAction<PdfConfig>>;
    companyData: CompanyData | null;
    templates: PdfTemplate[];
    setTemplates: React.Dispatch<React.SetStateAction<PdfTemplate[]>>;
    selectedTemplateId: number | null;
    setSelectedTemplateId: (id: number | null) => void;
    pdfUrl: string | null;
    isLoading: boolean;
    isPreviewLoading: boolean;
    mode: 'design' | 'preview';
    setMode: (mode: 'design' | 'preview') => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    saveHistory: () => void;
    undo: () => void;
    redo: () => void;
}

const PdfLayoutFetchContext =
    createContext<PdfLayoutFetchContextType | undefined>(undefined);

export function PdfLayoutFetchProvider({
    children,
}: {
    children: React.ReactNode;
}): React.ReactNode {
    const [config, setConfig] = useState<PdfConfig>(DEFAULT_CONFIG);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [mode, setMode] = useState<'design' | 'preview'>('design');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [history, setHistory] = useState<PdfConfig[]>([]);
    const [redoStack, setRedoStack] = useState<PdfConfig[]>([]);
    
    const blobUrlRef = useRef<string | null>(null);

    // Initial load
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                const cached = localStorage.getItem('pdf_company_data');
                if (cached) setCompanyData(JSON.parse(cached));

                const [compRes, tpls] = await Promise.all([
                    fetch("/api/pdf/company"),
                    pdfTemplateService.fetchTemplates()
                ]);

                if (compRes.ok) {
                    const result = await compRes.json();
                    const company = result.data?.[0] || (Array.isArray(result.data) ? null : result.data);
                    setCompanyData(company);
                    if (company) localStorage.setItem('pdf_company_data', JSON.stringify(company));
                }
                setTemplates(tpls as PdfTemplate[]);
            } catch (error) {
                console.error("Error initializing PDF Editor Provider:", error);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Preview regeneration
    const updatePreview = useCallback(async () => {
        if (!companyData || mode !== 'preview') return;
        
        setIsPreviewLoading(true);
        try {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            const url = await getPdfBlobUrl(config, companyData);
            blobUrlRef.current = url;
            setPdfUrl(url);
        } catch (error) {
            console.error("Error generating preview in Provider:", error);
        } finally {
            setIsPreviewLoading(false);
        }
    }, [config, companyData, mode]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updatePreview();
        }, 500); 
        return () => clearTimeout(timer);
    }, [updatePreview]);

    // History Logic
    const saveHistory = useCallback(() => {
        setHistory(prev => {
            const lastSnapshot = prev[prev.length - 1];
            const currentStr = JSON.stringify(config);
            if (lastSnapshot && JSON.stringify(lastSnapshot) === currentStr) return prev;
            return [...prev, JSON.parse(currentStr)].slice(-50);
        });
        setRedoStack([]);
    }, [config]);

    const undo = useCallback(() => {
        if (history.length === 0) return;
        const lastSnapshot = history[history.length - 1];
        setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(config))]);
        setConfig(lastSnapshot);
        setHistory(prev => prev.slice(0, -1));
        toast.info("Undo", { duration: 1000, icon: React.createElement(Undo, { size: 14 }) });
    }, [history, config]);

    const redo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextSnapshot = redoStack[redoStack.length - 1];
        setHistory(prev => [...prev, JSON.parse(JSON.stringify(config))]);
        setConfig(nextSnapshot);
        setRedoStack(prev => prev.slice(0, -1));
        toast.info("Redo", { duration: 1000, icon: React.createElement(Redo, { size: 14 }) });
    }, [redoStack, config]);

    return React.createElement(
        PdfLayoutFetchContext.Provider,
        {
            value: {
                config,
                setConfig,
                companyData,
                templates,
                setTemplates,
                selectedTemplateId,
                setSelectedTemplateId,
                pdfUrl,
                isLoading,
                isPreviewLoading,
                mode,
                setMode,
                selectedId,
                setSelectedId,
                saveHistory,
                undo,
                redo,
            },
        },
        children
    );
}

export function usePdfLayoutFetchContext() {
    const ctx = useContext(PdfLayoutFetchContext);
    if (!ctx)
        throw new Error(
            "Must be used inside PdfLayoutFetchProvider"
        );
    return ctx;
}
