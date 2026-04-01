"use client";

import React from "react";
import { PdfLayoutFetchProvider } from "./providers/fetchProvider";
import { usePdfLayout } from "./hooks/usePdfLayout";
import { PdfSidebar } from "./components/PdfSidebar";
import { PdfDesigner } from "./components/PdfDesigner";
import { PdfPreview } from "./components/PdfPreview";

const PdfLayoutContent = () => {
    const {
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
        handleSaveTemplate,
        handleSelectTemplate,
        handleDeleteTemplate,
        handleDownload,
    } = usePdfLayout();

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

export const PdfLayoutModule = () => {
    return (
        <PdfLayoutFetchProvider>
            <PdfLayoutContent />
        </PdfLayoutFetchProvider>
    );
};
