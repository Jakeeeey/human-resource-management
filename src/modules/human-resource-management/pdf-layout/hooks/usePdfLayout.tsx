"use client";

import { useEffect, useState } from "react";
import { usePdfLayoutFetchContext } from "../providers/fetchProvider";
import { pdfTemplateService } from "@/components/pdf-layout-design/services/pdf-template";
import { generatePdf } from "@/components/pdf-layout-design/PdfGenerator";
import { DEFAULT_CONFIG } from "@/components/pdf-layout-design/constants";
import { toast } from "sonner";
import { PdfTemplate } from "../types";

export function usePdfLayout() {
    const {
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
    } = usePdfLayoutFetchContext();

    const [isSaving, setIsSaving] = useState(false);

    // Keyboard shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
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
                setTemplates(prev => prev.map(t => t.id === selectedTemplateId ? { ...t, name, config } : t));
                toast.success("Template updated successfully!");
            } else {
                const newTpl = await pdfTemplateService.saveTemplate(name, config);
                setTemplates(prev => [...prev, newTpl as PdfTemplate]);
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

    return {
        config,
        setConfig,
        companyData,
        templates,
        selectedTemplateId,
        pdfUrl,
        isLoading,
        isSaving,
        isPreviewLoading,
        mode,
        setMode,
        selectedId,
        setSelectedId,
        saveHistory,
        undo,
        redo,
        handleSaveTemplate,
        handleSelectTemplate,
        handleDeleteTemplate,
        handleDownload,
    };
}
