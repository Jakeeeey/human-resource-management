"use client";

import React from "react";

interface PdfPreviewProps {
    pdfUrl: string | null;
    isLoading: boolean;
}

export const PdfPreview: React.FC<PdfPreviewProps> = ({ pdfUrl, isLoading }) => {
    return (
        <div className="flex-1 bg-slate-200 h-full overflow-hidden p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-5xl h-full shadow-2xl rounded-lg overflow-hidden border border-slate-300 bg-white relative">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white bg-opacity-80 backdrop-blur-sm transition-all">
                        <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            <span className="text-slate-600 font-medium text-sm">Regenerating Preview...</span>
                        </div>
                    </div>
                )}
                
                {pdfUrl ? (
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full border-none"
                        title="PDF Preview"
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                        <div className="w-20 h-20 border-4 border-dashed border-slate-300 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <p className="font-medium">No preview available</p>
                    </div>
                )}
            </div>
            <div className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                Live PDF Preview (jsPDF Engine)
            </div>
        </div>
    );
};
