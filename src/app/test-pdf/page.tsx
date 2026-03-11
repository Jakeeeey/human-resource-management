'use client';

import React, { useState } from 'react';
import { generatePdfLayout } from '@/components/pdf-layout';
import { PdfEditor, generatePdfV2, PdfV2Layout } from '@/components/pdf-layout-v2';

export default function TestPdfPage() {
    const [mode, setMode] = useState<'v1' | 'v2'>('v1');
    const [loading, setLoading] = useState(false);

    const handleDownloadV1 = async () => {
        setLoading(true);
        try {
            await generatePdfLayout({
                tableOptions: {
                    head: [['Name', 'Position', 'Department']],
                    body: [
                        ['John Doe', 'Software Engineer', 'IT'],
                        ['Jane Smith', 'HR Manager', 'Human Resources'],
                        ['Alice Johnson', 'Marketing Director', 'Marketing'],
                    ],
                },
                filename: 'test-v1-layout.pdf',
            });
        } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to generate PDF.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportV2 = async (layout: PdfV2Layout) => {
        setLoading(true);
        try {
            await generatePdfV2(layout, 'test-v2-custom-layout.pdf');
        } catch (error) {
            console.error('V2 Export failed:', error);
            alert('Failed to export V2 PDF.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-10 space-y-8 min-h-screen bg-gray-50/50">
            <div className="flex items-center justify-between border-b pb-4 bg-white p-4 rounded-xl shadow-sm">
                <h1 className="text-2xl font-bold text-gray-800">PDF Layout Studio</h1>
                <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('v1')}
                        className={`px-6 py-2 rounded-md transition duration-200 ${mode === 'v1' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        V1 Standard
                    </button>
                    <button
                        onClick={() => setMode('v2')}
                        className={`px-6 py-2 rounded-md transition duration-200 ${mode === 'v2' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        V2 Visual Editor
                    </button>
                </div>
            </div>

            {mode === 'v1' ? (
                <div className="max-w-xl mx-auto space-y-4 bg-white p-8 rounded-2xl shadow-xl text-center">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    </div>
                    <h2 className="text-xl font-bold">Standard Layout</h2>
                    <p className="text-gray-500">
                        Generates a PDF using the fixed pre-defined company header and standard table styles.
                    </p>
                    <button
                        onClick={handleDownloadV1}
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition shadow-lg shadow-blue-200 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Generate PDF V1'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                        <p className="text-sm text-blue-700">
                            <strong>Note:</strong> Drag and resize elements on the canvas below. Changes will be reflected in the exported PDF.
                        </p>
                    </div>
                    <PdfEditor onExport={handleExportV2} />
                </div>
            )}
        </div>
    );
}

