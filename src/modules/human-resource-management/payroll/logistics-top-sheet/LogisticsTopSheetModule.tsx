"use client";

import { useState } from "react";
import { useLogisticsTopSheet } from "./hooks/useLogisticsTopSheet";
import { LogisticsTopSheetTable } from "./components/LogisticsTopSheetTable";
import { generateLogisticsTopSheetPdf } from "./components/LogisticsTopSheetPdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, RefreshCw, Download, FileText } from "lucide-react";

export const LogisticsTopSheetModule = () => {
    const [cutoffStart, setCutoffStart] = useState("");
    const [cutoffEnd, setCutoffEnd] = useState("");
    const { data, isLoading, error, loadData } = useLogisticsTopSheet();

    const handleLoadData = () => {
        if (!cutoffStart || !cutoffEnd) return;
        loadData(cutoffStart, cutoffEnd);
    };

    const handlePrintPdf = async () => {
        if (!cutoffStart || !cutoffEnd || data.length === 0) return;
        try {
            await generateLogisticsTopSheetPdf(data, cutoffStart, cutoffEnd);
        } catch (err) {
            console.error("Failed to generate PDF:", err);
            alert("Failed to generate PDF. Check console for details.");
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Logistics Payroll Top Sheet</h1>
                    <p className="text-sm text-slate-500">
                        View and print the payroll summary for Logistics staff (Drivers & Helpers) based on dispatch cuts.
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        onClick={handlePrintPdf}
                        disabled={data.length === 0 || isLoading}
                        className="gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print Top Sheet
                    </Button>
                </div>
            </div>

            <div className="p-4 bg-white border rounded-lg shadow-sm">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5 flex-1 min-w-[200px] max-w-[250px]">
                        <Label htmlFor="cutoffStart" className="text-sm font-medium text-slate-700">Cutoff Start</Label>
                        <Input 
                            id="cutoffStart" 
                            type="date" 
                            value={cutoffStart} 
                            onChange={(e) => setCutoffStart(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-[200px] max-w-[250px]">
                        <Label htmlFor="cutoffEnd" className="text-sm font-medium text-slate-700">Cutoff End</Label>
                        <Input 
                            id="cutoffEnd" 
                            type="date" 
                            value={cutoffEnd} 
                            onChange={(e) => setCutoffEnd(e.target.value)} 
                        />
                    </div>
                    <Button 
                        onClick={handleLoadData} 
                        disabled={!cutoffStart || !cutoffEnd || isLoading}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        Generate Report
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm">
                    {error}
                </div>
            )}

            <LogisticsTopSheetTable data={data} />
        </div>
    );
};
