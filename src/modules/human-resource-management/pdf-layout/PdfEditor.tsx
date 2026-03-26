"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PdfConfig, CompanyData } from "@/components/pdf-layout-design/types";
import { DEFAULT_CONFIG } from "@/components/pdf-layout-design/constants";
import { PdfSidebar } from "./PdfSidebar";
import { PdfPreview } from "./PdfPreview";
import { PdfDesigner } from "./PdfDesigner";
import { generatePdf, getPdfBlobUrl } from "@/components/pdf-layout-design/PdfGenerator";
import { pdfTemplateService, PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import { toast } from "sonner";
import { Undo, Redo } from "lucide-react";

export const PdfEditor: React.FC = () => {
    const [config, setConfig] = useState<PdfConfig>(DEFAULT_CONFIG);
    const [companyData, setCompanyData] = useState<CompanyData | null>(null);
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [mode, setMode] = useState<'design' | 'preview'>('design');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [, setHistory] = useState<PdfConfig[]>([]);
    const [, setRedoStack] = useState<PdfConfig[]>([]);
    
    const blobUrlRef = useRef<string | null>(null);

    // Fetch initial data
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                // SWR Style: Load from cache first
                const cached = localStorage.getItem('pdf_company_data');
                if (cached) setCompanyData(JSON.parse(cached));

                // Fetch Company Data and Templates in parallel
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

                setTemplates(tpls);
            } catch (error) {
                console.error("Error initializing PDF Editor:", error);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const updatePreview = useCallback(async () => {
        if (!companyData || mode !== 'preview') return;
        
        setIsPreviewLoading(true);
        try {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            const url = await getPdfBlobUrl(config, companyData);
            blobUrlRef.current = url;
            setPdfUrl(url);
        } catch (error) {
            console.error("Error generating preview:", error);
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
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const previous = prev[prev.length - 1];
            setRedoStack(f => [...f, JSON.parse(JSON.stringify(config))]);
            setConfig(previous);
            toast.info("Undo", { duration: 1000, icon: <Undo size={14} /> });
            return prev.slice(0, -1);
        });
    }, [config]);

    const redo = useCallback(() => {
        setRedoStack(prev => {
            if (prev.length === 0) return prev;
            const next = prev[prev.length - 1];
            setHistory(h => [...h, JSON.parse(JSON.stringify(config))]);
            setConfig(next);
            toast.info("Redo", { duration: 1000, icon: <Redo size={14} /> });
            return prev.slice(0, -1);
        });
    }, [config]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea to avoid accidental undoing while typing
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                // Allow Undo/Redo inside inputs but don't prevent default for our global handler
                // unless it's a specific action we want to control.
                // For now, let's keep it global but maybe filter if needed.
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    redo();
                } else {
                    e.preventDefault();
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const handleSaveTemplate = async (name: string) => {
        setIsSaving(true);
        try {
            if (selectedTemplateId) {
                await pdfTemplateService.updateTemplate(selectedTemplateId, config, name);
                // Update local list
                setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...t, name, config } : t));
                toast.success("Template updated successfully!");
            } else {
                const newTpl = await pdfTemplateService.saveTemplate(name, config);
                setTemplates(prev => [...prev, newTpl]);
                setSelectedTemplateId(newTpl.id);
                toast.success("Template saved successfully!");
            }
        } catch (error) {
            console.error("Error saving template:", error);
            toast.error("Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSelectTemplate = (id: number | null) => {
        if (id === null) {
            setConfig(DEFAULT_CONFIG);
            setSelectedTemplateId(null);
            return;
        }
        const tpl = templates.find(t => t.id === id);
        if (tpl) {
            setConfig(tpl.config);
            setSelectedTemplateId(id);
        }
    };

    const handleDeleteTemplate = async (id: number) => {
        try {
            await pdfTemplateService.deleteTemplate(id);
            setTemplates(prev => prev.filter(t => t.id !== id));
            if (selectedTemplateId === id) {
                setConfig(DEFAULT_CONFIG);
                setSelectedTemplateId(null);
            }
            toast.success("Template deleted successfully!");
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("Failed to delete template.");
        }
    };

    const handleDownload = async () => {
        if (!companyData) return;
        const doc = await generatePdf(config, companyData);
        doc.save(`printable-template-${new Date().getTime()}.pdf`);
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] bg-slate-100 overflow-hidden">
            <PdfSidebar 
                config={config} 
                setConfig={setConfig} 
                onDownload={handleDownload} 
                onSave={handleSaveTemplate}
                templates={templates}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={handleSelectTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                saveHistory={saveHistory}
                isSaving={isSaving}
                mode={mode}
                setMode={setMode}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
            />
            <div className="flex-1 overflow-auto flex flex-col bg-slate-200">
                {mode === 'design' ? (
                    <PdfDesigner 
                        config={config} 
                        setConfig={setConfig} 
                        data={companyData} 
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        saveHistory={saveHistory}
                    />
                ) : (
                    <PdfPreview pdfUrl={pdfUrl} isLoading={isPreviewLoading} />
                )}
            </div>
        </div>
    );
};
