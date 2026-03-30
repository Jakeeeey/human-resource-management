"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
    PdfConfig,
    PdfElementConfig,
    PdfTemplate,
    PageNumberConfig,
    PaperSize
} from "../types";
import { PAPER_SIZES, DEFAULT_CONFIG } from "@/components/pdf-layout-design/constants";
import {
    Download, Trash2, Type, Square, Save, Database, LayoutGrid, MousePointer2,
    Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, Maximize2, Minus, Image as ImageIcon
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PdfSidebarProps {
    config: PdfConfig;
    setConfig: React.Dispatch<React.SetStateAction<PdfConfig>>;
    onDownload: () => void;
    onSave: (name: string) => void;
    templates: PdfTemplate[];
    selectedTemplateId: number | null;
    onSelectTemplate: (id: number | null) => void;
    onDeleteTemplate?: (id: number) => void;
    isSaving: boolean;
    mode: 'design' | 'preview';
    setMode: (mode: 'design' | 'preview') => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    saveHistory: () => void;
}

export const PdfSidebar: React.FC<PdfSidebarProps> = ({
    config, setConfig, onDownload, onSave, templates, selectedTemplateId,
    onSelectTemplate, onDeleteTemplate, saveHistory, isSaving, mode, setMode, selectedId, setSelectedId
}) => {
    const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [saveName, setSaveName] = useState<string>("");

    useEffect(() => {
        if (selectedId && scrollRefs.current[selectedId]) {
            scrollRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedId]);

    // Sync saveName with selected template name
    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedTemplateId) {
                const tpl = templates.find(t => t.id === selectedTemplateId);
                if (tpl) {
                    setSaveName(tpl.name);
                }
            } else {
                setSaveName("");
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [selectedTemplateId, templates]);

    const handleAddCustom = (type: 'custom_text' | 'shape') => {
        saveHistory();
        const id = `custom_${Date.now()}`;
        const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };
        const newEl: PdfElementConfig = {
            id,
            type,
            label: type === 'custom_text' ? 'New Text' : 'New Line',
            visible: true,
            x: margins.left + 5,
            y: margins.top + 5,
            width: type === 'custom_text' ? 50 : 100,
            height: type === 'custom_text' ? 10 : 1,
            align: 'left',
            style: { fontSize: 10, fontFamily: 'helvetica', fontWeight: 'normal', color: '#000000' },
            content: type === 'custom_text' ? 'Sample Text' : undefined,
            shapeType: type === 'shape' ? 'line' : undefined,
            borderWidth: type === 'shape' ? 0.5 : undefined,
            borderColor: type === 'shape' ? '#000000' : undefined,
        };
        setConfig(prev => ({ ...prev, elements: { ...prev.elements, [id]: newEl } }));
        setSelectedId(id);
    };

    const handleDelete = (id: string) => {
        if (id.startsWith('company_')) return;
        saveHistory();
        setConfig(prev => {
            const newElements = { ...prev.elements };
            delete newElements[id];
            return { ...prev, elements: newElements };
        });
        if (selectedId === id) setSelectedId(null);
    };

    const handleStyleChange = (id: string, field: string, value: string | number) => {
        setConfig((prev) => ({
            ...prev,
            elements: {
                ...prev.elements,
                [id]: {
                    ...prev.elements[id],
                    style: { ...prev.elements[id].style, [field]: value },
                },
            },
        }));
    };

    return (
        <div className="w-85 h-full border-r bg-white overflow-y-auto flex flex-col shadow-sm scroll-smooth scroll-pt-[120px]">
            {/* Mode Selector */}
            <div className="p-4 border-b bg-slate-50 sticky top-0 z-10">
                <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button onClick={() => setMode('design')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'design' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}>Design</button>
                    <button onClick={() => setMode('preview')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'preview' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}>Preview</button>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6">
                {/* Database Templates Section */}
                <section className="flex flex-col gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-1">
                        <Database size={14} className="text-blue-600" />
                        <h3 className="text-xs font-bold uppercase text-blue-600 tracking-wider">Template Manager</h3>
                    </div>

                    <div className="flex flex-col gap-2">
                        <select
                            className="w-full p-2 border border-blue-200 rounded-md text-xs bg-white focus:ring-2 focus:ring-blue-100"
                            value={selectedTemplateId || ""}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onSelectTemplate(e.target.value ? Number(e.target.value) : null)}
                        >
                            <option value="">-- New Template --</option>
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>

                        <div className="flex flex-col gap-1 mt-1">
                            <input
                                type="text"
                                placeholder="Template Name"
                                className="w-full p-2 border border-blue-100 rounded-md text-xs"
                                value={saveName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSaveName(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => onSave(saveName || "Untitled Template")}
                                disabled={isSaving}
                                className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all
                                    ${isSaving ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100'}`}
                            >
                                <Save size={14} />
                                {isSaving ? 'Saving...' : selectedTemplateId ? 'Update Template' : 'Save Template'}
                            </button>

                            {selectedTemplateId && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button
                                            title="Delete Template"
                                            className="p-2 border border-red-200 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                             <AlertDialogDescription>
                                                 This will permanently delete the template &quot;<span className="font-bold text-slate-700">{saveName}</span>&quot;. This action cannot be undone.
                                             </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-red-600 hover:bg-red-700 text-white"
                                                onClick={() => onDeleteTemplate && onDeleteTemplate(selectedTemplateId)}
                                            >
                                                Delete
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Canvas Options</h3>
                    
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 font-medium">Paper Size</label>
                            <select 
                                className="w-full p-2 border border-slate-200 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                                value={config.paperSize}
                                onChange={(e) => {
                                    saveHistory();
                                    setConfig(prev => ({ ...prev, paperSize: e.target.value as PaperSize }));
                                }}
                            >
                                <option value="A4">A4 (210 x 297mm)</option>
                                <option value="Letter">Letter (215.9 x 279.4mm)</option>
                                <option value="Legal">Legal (215.9 x 355.6mm)</option>
                                <option value="Custom">Custom Size</option>
                            </select>
                        </div>

                        {config.paperSize === 'Custom' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold">W (mm)</label>
                                    <input 
                                        type="number" 
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={config.customSize.width} 
                                        onFocus={saveHistory}
                                        onChange={e => setConfig(prev => ({ ...prev, customSize: { ...prev.customSize, width: Number(e.target.value) } }))} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold">H (mm)</label>
                                    <input 
                                        type="number" 
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={config.customSize.height} 
                                        onFocus={saveHistory}
                                        onChange={e => setConfig(prev => ({ ...prev, customSize: { ...prev.customSize, height: Number(e.target.value) } }))} 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-500 font-medium">Orientation</label>
                            <div className="flex bg-slate-100 p-1 rounded-md">
                                <button 
                                    onClick={() => { saveHistory(); setConfig(prev => ({ ...prev, orientation: 'portrait' })); }}
                                    className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase rounded transition-all ${config.orientation === 'portrait' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                                >
                                    Portrait
                                </button>
                                <button 
                                    onClick={() => { saveHistory(); setConfig(prev => ({ ...prev, orientation: 'landscape' })); }}
                                    className={`flex-1 py-1 px-2 text-[10px] font-bold uppercase rounded transition-all ${config.orientation === 'landscape' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                                >
                                    Landscape
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <label className="text-[10px] text-slate-500 font-medium border-t pt-2 mt-2">Page Margins (Inches)</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Top</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={(config.margins.top / 25.4).toFixed(2)} 
                                        onChange={e => {
                                            const val = Number(e.target.value) * 25.4;
                                            setConfig(prev => ({ ...prev, margins: { ...prev.margins, top: val } }));
                                        }} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Bottom</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={(config.margins.bottom / 25.4).toFixed(2)} 
                                        onChange={e => {
                                            const val = Number(e.target.value) * 25.4;
                                            setConfig(prev => ({ ...prev, margins: { ...prev.margins, bottom: val } }));
                                        }} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Left</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={(config.margins.left / 25.4).toFixed(2)} 
                                        onChange={e => {
                                            const val = Number(e.target.value) * 25.4;
                                            setConfig(prev => ({ ...prev, margins: { ...prev.margins, left: val } }));
                                        }} 
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Right</label>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="p-1.5 border rounded text-xs bg-white" 
                                        value={(config.margins.right / 25.4).toFixed(2)} 
                                        onChange={e => {
                                            const val = Number(e.target.value) * 25.4;
                                            setConfig(prev => ({ ...prev, margins: { ...prev.margins, right: val } }));
                                        }} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <button onClick={() => { saveHistory(); setConfig(prev => ({ ...prev, showGrid: !prev.showGrid })); }}
                            className={`flex items-center justify-center gap-2 p-2 border rounded-md text-[11px] transition-all ${config.showGrid ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-slate-500'}`}>
                            <LayoutGrid size={13} /> Grid
                        </button>
                        <button onClick={() => { saveHistory(); setConfig(prev => ({ ...prev, snapToGrid: !prev.snapToGrid })); }}
                            className={`flex items-center justify-center gap-2 p-2 border rounded-md text-[11px] transition-all ${config.snapToGrid ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-slate-500'}`}>
                            <MousePointer2 size={13} /> Snap
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 mt-4 border-t pt-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Body Boundaries (mm)</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-green-600 font-bold">START</label>
                                <input 
                                    type="number" 
                                    className="p-1.5 border border-green-100 rounded text-xs bg-green-50/20" 
                                    value={config.bodyStart ?? 50} 
                                    onChange={e => setConfig(prev => ({ ...prev, bodyStart: Number(e.target.value) }))} 
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] text-orange-600 font-bold">END</label>
                                <input 
                                    type="number" 
                                    className="p-1.5 border border-orange-100 rounded text-xs bg-orange-50/20" 
                                    value={config.bodyEnd ?? 250} 
                                    onChange={e => setConfig(prev => ({ ...prev, bodyEnd: Number(e.target.value) }))} 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-4 border-t pt-2">
                        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Page Numbers</label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-slate-600 bg-slate-50 p-2 rounded-md border border-slate-100 hover:bg-slate-100 transition-colors">
                            <input
                                type="checkbox"
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3 cursor-pointer"
                                checked={config.pageNumber?.show || false}
                                onChange={(e) => {
                                    saveHistory();
                                    setConfig(prev => ({
                                        ...prev,
                                        pageNumber: { ...(prev.pageNumber || DEFAULT_CONFIG.pageNumber!), show: e.target.checked }
                                    }));
                                }}
                            />
                            Show Page Numbers
                        </label>

                        {config.pageNumber?.show && (
                            <div className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-100 rounded-md">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Format</label>
                                    <input
                                        type="text"
                                        className="p-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        value={config.pageNumber.format}
                                        onFocus={saveHistory}
                                        onChange={(e) => setConfig(prev => ({
                                            ...prev,
                                            pageNumber: { ...prev.pageNumber!, format: e.target.value }
                                        }))}
                                        placeholder="Page {pageNumber} of {totalPages}"
                                    />
                                    <span className="text-[9px] text-slate-400">Use: <code className="text-[8px] bg-slate-200 px-1 rounded">{'{pageNumber}'}</code> and <code className="text-[8px] bg-slate-200 px-1 rounded">{'{totalPages}'}</code></span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Position</label>
                                    <select
                                        className="p-1.5 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        value={config.pageNumber.position}
                                        onChange={(e) => {
                                            saveHistory();
                                            setConfig(prev => ({
                                                ...prev,
                                                pageNumber: { ...prev.pageNumber!, position: e.target.value as PageNumberConfig['position'] }
                                            }));
                                        }}
                                    >
                                        <option value="bottom-left">Bottom Left</option>
                                        <option value="bottom-center">Bottom Center</option>
                                        <option value="bottom-right">Bottom Right</option>
                                        <option value="top-left">Top Left</option>
                                        <option value="top-center">Top Center</option>
                                        <option value="top-right">Top Right</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Toolbox</h3>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleAddCustom('custom_text')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md text-[11px] hover:bg-slate-50 group">
                            <Type size={14} className="text-blue-500 group-hover:scale-110" /> Add Text
                        </button>
                        <button onClick={() => handleAddCustom('shape')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md text-[11px] hover:bg-slate-50 group">
                            <Minus size={14} className="text-slate-500 group-hover:scale-110" /> Add Line
                        </button>
                    </div>
                </section>

                <section className="flex flex-col gap-1">
                    <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Elements</h3>
                    <div className="flex flex-col gap-4">
                        {Object.values(config.elements).map((el) => {
                            const isSelected = selectedId === el.id;
                            return (
                                <div 
                                    key={el.id} 
                                    ref={domEl => { scrollRefs.current[el.id] = domEl; }}
                                    onClick={() => setSelectedId(el.id)}
                                    className={`border rounded-lg overflow-hidden transition-all duration-300 shadow-sm cursor-pointer
                                        ${isSelected ? 'border-blue-500 ring-2 ring-blue-100 ring-opacity-50 scale-[1.02]' : 'border-slate-200 hover:border-blue-200'}`}
                                >
                                    <div className={`p-2 flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50' : el.visible ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                                        <div className="flex items-center gap-2 max-w-[140px]">
                                            {el.type === 'text' && <Type size={12} className={isSelected ? 'text-blue-500' : 'text-slate-400'} />}
                                            {el.type === 'image' && <ImageIcon size={12} className={isSelected ? 'text-blue-500' : 'text-slate-400'} />}
                                            {el.type === 'shape' && <Square size={12} className={isSelected ? 'text-blue-500' : 'text-slate-400'} />}
                                            <span className={`text-[11px] font-bold uppercase truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{el.label}</span>
                                        </div>
                                        <div className="flex gap-1 items-center">
                                            {!el.id.startsWith('company_') && (
                                                <button onClick={(e) => { e.stopPropagation(); handleDelete(el.id); }} className="p-1 hover:text-red-500 text-slate-400">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, visible: !el.visible } } })); }}>
                                                {el.visible ? <Eye size={14} className="text-blue-500" /> : <EyeOff size={14} />}
                                            </button>
                                        </div>
                                    </div>

                                    {(el.visible || isSelected) && (
                                        <div className={`p-3 border-t flex flex-col gap-3 text-[10px] transition-colors ${isSelected ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            <div className="flex items-center justify-between border-b pb-2 mb-1">
                                                <div className="flex bg-slate-200 p-0.5 rounded gap-0.5">
                                                    {(['left', 'center', 'right'] as const).map(a => (
                                                        <button key={a} onClick={() => { saveHistory(); setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, align: a } } })); }}
                                                            className={`p-1 rounded ${el.align === a ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                                                            {a === 'left' ? <AlignLeft size={10} /> : a === 'center' ? <AlignCenter size={10} /> : <AlignRight size={10} />}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button onClick={() => {
                                                    saveHistory();
                                                    const base = config.paperSize === 'Custom' ? config.customSize : PAPER_SIZES[config.paperSize];
                                                    const w = config.orientation === 'landscape' ? base.height : base.width;
                                                    setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, x: 10, width: w - 20 } } }));
                                                }} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="Full Width">
                                                    <Maximize2 size={10} />
                                                </button>
                                            </div>

                                            {el.type === 'custom_text' && (
                                                <input 
                                                    type="text" 
                                                    className="w-full p-1 border rounded bg-white shadow-inner" 
                                                    value={el.content} 
                                                    onFocus={saveHistory}
                                                    onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, content: e.target.value } } }))} 
                                                />
                                            )}

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] text-slate-400 font-bold uppercase">X (mm)</label>
                                                    <input 
                                                        type="number" 
                                                        className="p-1 border rounded bg-white font-mono" 
                                                        value={Math.round(el.x)} 
                                                        onFocus={saveHistory}
                                                        onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, x: Number(e.target.value) } } }))} 
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Y (mm)</label>
                                                    <input 
                                                        type="number" 
                                                        className="p-1 border rounded bg-white font-mono" 
                                                        value={Math.round(el.y)} 
                                                        onFocus={saveHistory}
                                                        onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, y: Number(e.target.value) } } }))} 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] text-slate-400 font-bold uppercase">Width (mm)</label>
                                                    <input type="number" className="p-1 border rounded bg-white font-mono" value={Math.round(el.width)} onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, width: Number(e.target.value) } } }))} />
                                                </div>
                                                {!(el.type === 'shape' && el.shapeType === 'line') && (
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] text-slate-400 font-bold uppercase">Height (mm)</label>
                                                        <input type="number" className="p-1 border rounded bg-white font-mono" value={Math.round(el.height)} onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, height: Number(e.target.value) } } }))} />
                                                    </div>
                                                )}
                                            </div>

                                            {el.type !== 'shape' && el.type !== 'image' && (
                                                <div className="flex flex-col gap-3 border-b pb-3 mb-1">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] text-slate-400 font-bold uppercase">Size (pt)</label>
                                                            <input type="number" className="p-1 border rounded bg-white text-xs" value={el.style.fontSize} onChange={e => handleStyleChange(el.id, 'fontSize', Number(e.target.value))} />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] text-slate-400 font-bold uppercase">Height (mm)</label>
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                className="p-1 border rounded bg-white text-xs font-mono" 
                                                                value={(el.style.fontSize * 0.3528).toFixed(1)} 
                                                                onChange={e => handleStyleChange(el.id, 'fontSize', Number((Number(e.target.value) / 0.3528).toFixed(1)))} 
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] text-slate-400 font-bold uppercase">Spacing (Char)</label>
                                                            <input type="number" step="0.5" className="p-1 border rounded bg-white text-xs" value={el.style.letterSpacing || 0} onChange={e => handleStyleChange(el.id, 'letterSpacing', Number(e.target.value))} />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[9px] text-slate-400 font-bold uppercase">Line H (Ratio)</label>
                                                            <input type="number" step="0.05" className="p-1 border rounded bg-white text-xs" value={el.style.lineHeight || 1.15} onChange={e => handleStyleChange(el.id, 'lineHeight', Number(e.target.value))} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {el.type === 'shape' && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] text-slate-400 font-bold uppercase">Thickness</label>
                                                        <input type="number" step="0.1" className="p-1 border rounded bg-white" value={el.borderWidth} onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, borderWidth: Number(e.target.value) } } }))} />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] text-slate-400 font-bold uppercase">Color</label>
                                                        <input type="color" className="w-full h-6 rounded cursor-pointer" value={el.borderColor} onChange={e => setConfig(prev => ({ ...prev, elements: { ...prev.elements, [el.id]: { ...el, borderColor: e.target.value } } }))} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            <div className="flex-1 min-h-[50px]"></div>

            <div className="p-4 border-t bg-slate-50 sticky bottom-0 z-10 flex flex-col gap-2">
                <button
                    onClick={onDownload}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl shadow transition-all flex items-center justify-center gap-2 transform active:scale-95 duration-200 text-sm"
                >
                    <Download size={16} />
                    Download PDF
                </button>
            </div>
        </div>
    );
};
