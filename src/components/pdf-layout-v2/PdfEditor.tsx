'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
    DndContext,
    useDraggable,
    useDroppable,
    DragOverlay,
    DragEndEvent,
    DragStartEvent
} from '@dnd-kit/core';
import Moveable from 'react-moveable';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Type,
    Image as ImageIcon,
    Trash2,
    Download,
    Layout,
    MousePointer2,
    Eye,
    Settings2,
    GripVertical,
    PlusCircle,
    Hash,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LayoutElement, PdfV2Layout, ElementType } from './types';
import { Company } from '../pdf-layout/types';

const MM_TO_PX = 3.78;

interface LibraryItemProps {
    id: string;
    label: string;
    type: ElementType;
    icon: React.ReactNode;
}

// --- Components ---

/**
 * Draggable item in the sidebar library
 */
const DraggableLibraryItem: React.FC<LibraryItemProps> = ({ id, label, type, icon }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `lib-${id}`,
        data: { type, label, fieldKey: id }
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(
                "group flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white transition-all duration-200 cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5",
                isDragging && "opacity-40 grayscale"
            )}
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                    {icon}
                </div>
                <span className="text-sm font-semibold text-slate-700">{label}</span>
            </div>
            <PlusCircle size={14} className="text-slate-300 group-hover:text-blue-500" />
        </div>
    );
};

export const PdfEditor: React.FC<PdfEditorProps> = ({ onExport }) => {
    const [elements, setElements] = useState<LayoutElement[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const [companyData, setCompanyData] = useState<Company | null>(null);
    const [activeDragItem, setActiveDragItem] = useState<{ type: ElementType, label: string, fieldKey: string } | null>(null);
    const [canvasElement, setCanvasElement] = useState<HTMLDivElement | null>(null);

    // Load initial company data
    useEffect(() => {
        const fetchCompanyData = async () => {
            try {
                const res = await fetch('/api/pdf-layout/company');
                const data = await res.json();
                const company = data?.data?.[0];
                setCompanyData(company);

                if (company) {
                    // Default V1-ish layout converted to V2 elements
                    setElements([
                        { id: 'logo', type: 'image', x: 15, y: 15, width: 45, height: 25, content: company.company_logo ?? undefined, fieldKey: 'company_logo' },
                        { id: 'name', type: 'text', x: 70, y: 20, width: 100, height: 10, content: company.company_name ?? undefined, fieldKey: 'company_name', fontSize: 10, fontWeight: 'bold' },
                    ]);
                }
            } catch (e) {
                console.error("Failed to load company for studio", e);
            }
        };
        fetchCompanyData();
    }, []);

    const updateElement = (id: string, updates: Partial<LayoutElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current as { type: ElementType, label: string, fieldKey: string } | undefined;
        if (data) setActiveDragItem(data);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragItem(null);
        const { over, active } = event;

        if (over && over.id === 'canvas-droppable') {
            const { type, label, fieldKey } = active.data.current as { type: ElementType, label: string, fieldKey: string };

            // Calculate relative position based on where dropped
            // For simplicity, we drop at a default offset or calculate from pointer soon
            const rawContent = companyData && fieldKey in companyData 
                ? companyData[fieldKey as keyof Company]
                : null;

            const newEl: LayoutElement = {
                id: `el-${Math.random().toString(36).substr(2, 9)}`,
                type,
                x: 65,
                y: 40,
                width: type === 'image' ? 40 : 80,
                height: type === 'image' ? 30 : 10,
                content: typeof rawContent === 'string' ? rawContent : label,
                fieldKey,
                fontSize: 9,
            };

            // Auto-format full address
            if (fieldKey === 'company_address_full') {
                newEl.content = [
                    companyData?.company_address,
                    companyData?.company_brgy,
                    companyData?.company_city,
                    companyData?.company_province,
                    companyData?.company_zipCode
                ].filter(Boolean).join(', ');
            }

            setElements(prev => [...prev, newEl]);
        }
    };

    const selectedElement = elements.find(el => el.id === selectedId);

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex bg-[#121417] h-[850px] w-full rounded-[2rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/5 font-sans relative">

                {/* Left Sidebar: Library */}
                <aside className="w-[320px] bg-[#1a1d21] border-r border-white/5 flex flex-col z-30 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/5 bg-[#1a1d21]/80 backdrop-blur-xl">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
                            <h2 className="text-xl font-black text-white tracking-tight">Studio Pro</h2>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Header Designer</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                        <section>
                            <div className="flex items-center justify-between mb-4 px-2">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Library</h3>
                                <span className="text-[10px] text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded-full uppercase">Drag Items</span>
                            </div>
                            <div className="space-y-3">
                                <DraggableLibraryItem id="company_logo" label="Company Logo" type="image" icon={<ImageIcon size={18} />} />
                                <DraggableLibraryItem id="company_name" label="Company Name" type="text" icon={<Type size={18} />} />
                                <DraggableLibraryItem id="company_address_full" label="Full Address" type="text" icon={<Layout size={18} />} />
                                <DraggableLibraryItem id="company_contact" label="Contact Details" type="text" icon={<Hash size={18} />} />
                            </div>
                        </section>

                        {/* Canvas Ruler/Stats Toggle (Placeholder) */}
                        <section className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-3 mb-4">
                                <MousePointer2 size={16} className="text-blue-500" />
                                <span className="text-xs font-bold text-slate-300">Editor Helpers</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium bg-black/20 p-2 rounded-lg">
                                    <span>Smart Snapping</span>
                                    <div className="w-8 h-4 bg-blue-600 rounded-full flex items-center justify-end px-1"><div className="w-2.5 h-2.5 bg-white rounded-full" /></div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="p-8 border-t border-white/5 bg-black/20">
                        <button
                            onClick={() => onExport?.({ elements, pageSize: { width: 210, height: 297 } })}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-[1.2rem] transition-all duration-300 shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-95 group focus:ring-4 focus:ring-blue-500/30"
                        >
                            <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                            Generate PDF
                        </button>
                    </div>
                </aside>

                {/* Main Canvas Area */}
                <main className="flex-1 overflow-hidden relative flex flex-col items-center justify-center bg-[#0d0f11] pattern-grid">

                    {/* Canvas Toolbar */}
                    <div className="absolute top-8 left-8 right-8 h-16 bg-[#1a1d21]/60 backdrop-blur-3xl border border-white/5 rounded-2xl flex items-center px-6 justify-between z-40 shadow-2xl">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-green-500/10">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                                Synced
                            </div>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">A4 Canvas • 210mm x 297mm</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"><Eye size={18} /></button>
                            <button className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"><Settings2 size={18} /></button>
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <CanvasDroppable id="canvas-droppable" onRef={setCanvasElement}>
                            {elements.map((el) => (
                                <div
                                    key={el.id}
                                    id={el.id}
                                    className={cn(
                                        "absolute cursor-move group transition-shadow overflow-hidden",
                                        selectedId === el.id ? "z-40 ring-2 ring-blue-500 shadow-2xl" : "z-10 ring-1 ring-slate-200/50 hover:ring-blue-400/50"
                                    )}
                                    style={{
                                        left: `${el.x}mm`,
                                        top: `${el.y}mm`,
                                        width: `${el.width}mm`,
                                        height: `${el.height}mm`,
                                        backgroundColor: el.type === 'line' ? 'transparent' : 'white'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedId(el.id);
                                        setTarget(e.currentTarget);
                                    }}
                                >
                                    <div className="w-full h-full relative pointer-events-none flex items-center justify-center">
                                        {el.type === 'image' && el.content ? (
                                            <Image 
                                                src={el.content} 
                                                className="w-full h-full object-contain p-1" 
                                                alt="element" 
                                                width={200} 
                                                height={200} 
                                                unoptimized 
                                            />
                                        ) : el.type === 'text' ? (
                                            <div style={{ fontSize: `${el.fontSize || 10}pt`, fontWeight: el.fontWeight || 'normal' }} className="text-slate-900 text-center leading-tight">
                                                {el.content}
                                            </div>
                                        ) : (
                                            <div style={{ backgroundColor: el.color || '#000', height: `${el.thickness || 1}pt` }} className="w-full" />
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Moveable overlay */}
                            {canvasElement && (
                                <Moveable
                                    target={target}
                                    container={canvasElement}
                                    origin={false}
                                    edge={true}
                                    draggable={true}
                                    resizable={true}
                                    keepRatio={selectedElement?.type === 'image'}
                                    snappable={true}
                                    verticalGuidelines={[105]}
                                    snapCenter={true}
                                    onDrag={({ target, left, top }) => {
                                        target.style.left = `${left}px`;
                                        target.style.top = `${top}px`;
                                    }}
                                    onDragEnd={({ target }) => {
                                        const leftMm = parseFloat(target.style.left) / MM_TO_PX;
                                        const topMm = parseFloat(target.style.top) / MM_TO_PX;
                                        updateElement(target.id, { x: leftMm, y: topMm });
                                    }}
                                    onResize={({ target, width, height, drag }) => {
                                        target.style.width = `${width}px`;
                                        target.style.height = `${height}px`;
                                        target.style.left = `${drag.left}px`;
                                        target.style.top = `${drag.top}px`;
                                    }}
                                    onResizeEnd={({ target }) => {
                                        const id = target.id;
                                        const w = parseFloat(target.style.width) / MM_TO_PX;
                                        const h = parseFloat(target.style.height) / MM_TO_PX;
                                        const x = parseFloat(target.style.left) / MM_TO_PX;
                                        const y = parseFloat(target.style.top) / MM_TO_PX;
                                        updateElement(id, { width: w, height: h, x, y });
                                    }}
                                    className="custom-moveable"
                                />
                            )}
                        </CanvasDroppable>
                    </div>
                </main>

                {/* Right Sidebar: Properties */}
                <aside className="w-[320px] bg-[#1a1d21] border-l border-white/5 z-30 flex flex-col">
                    <div className="p-8 border-b border-white/5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                            <Settings2 size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Properties</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                        <AnimatePresence mode="wait">
                            {selectedElement ? (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="space-y-6"
                                >
                                    <div className="space-y-4 bg-white/5 p-5 rounded-3xl border border-white/10">
                                        <section className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</span>
                                                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-md uppercase">{selectedElement.type}</span>
                                            </div>

                                            {selectedElement.type === 'text' && (
                                                <>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Font Size</label>
                                                        <input
                                                            type="number"
                                                            value={selectedElement.fontSize || 10}
                                                            onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                                                            className="w-full bg-black/40 border border-white/5 p-3 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Weight</label>
                                                        <div className="flex p-1 bg-black/40 rounded-xl border border-white/5">
                                                            {(['normal', 'bold'] as const).map(w => (
                                                                <button
                                                                    key={w}
                                                                    onClick={() => updateElement(selectedId!, { fontWeight: w })}
                                                                    className={cn(
                                                                        "flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition-all",
                                                                        selectedElement.fontWeight === w ? "bg-white text-black shadow-lg" : "text-slate-500 hover:text-white"
                                                                    )}
                                                                >
                                                                    {w}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </section>

                                        <div className="h-px bg-white/5" />

                                        <section className="grid grid-cols-2 gap-3 pb-2">
                                            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex flex-col">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">X Pos</span>
                                                <span className="text-xs font-black text-white">{Math.round(selectedElement.x)}mm</span>
                                            </div>
                                            <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex flex-col">
                                                <span className="text-[8px] text-slate-500 font-bold uppercase">Y Pos</span>
                                                <span className="text-xs font-black text-white">{Math.round(selectedElement.y)}mm</span>
                                            </div>
                                        </section>

                                        <button
                                            onClick={() => { setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); setTarget(null); }}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all duration-300 text-xs font-bold"
                                        >
                                            <Trash2 size={14} /> Remove Element
                                        </button>
                                    </div>

                                    <section className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                                            <Info size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Pro Tip</span>
                                        </div>
                                        <p className="text-[10px] text-blue-400/70 leading-relaxed font-medium">Use the red center guide to perfectly align your header elements for a professional look.</p>
                                    </section>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-full flex flex-col items-center justify-center text-center space-y-4 px-4"
                                >
                                    <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-700">
                                        <MousePointer2 size={24} />
                                    </div>
                                    <div>
                                        <h4 className="text-slate-200 font-bold text-sm">No Selection</h4>
                                        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Click an element to edit properties</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </aside>

                {/* Floating Overlays */}
                <DragOverlay dropAnimation={null}>
                    {activeDragItem ? (
                        <div className="bg-blue-600/90 text-white backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 -rotate-2">
                            <GripVertical size={16} className="text-blue-200" />
                            <span className="text-sm font-black tracking-tight">{activeDragItem.label}</span>
                        </div>
                    ) : null}
                </DragOverlay>

                {/* Global Styles for Figma-like feel */}
                <style jsx global>{`
          .pattern-grid {
            background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0);
            background-size: 24px 24px;
          }
          .custom-moveable .moveable-control {
            width: 8px !important;
            height: 8px !important;
            background: #3b82f6 !important;
            border: 2px solid white !important;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5) !important;
            border-radius: 2px !important;
          }
          .custom-moveable .moveable-line {
            background: #3b82f6 !important;
            opacity: 0.8;
          }
          .custom-moveable .moveable-guideline {
            background: #f87171 !important;
            opacity: 0.8 !important;
            box-shadow: 0 0 8px rgba(248, 113, 113, 1) !important;
          }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        `}</style>
            </div>
        </DndContext>
    );
};

/**
 * Droppable area for the canvas
 */
const CanvasDroppable: React.FC<{ id: string, onRef: (el: HTMLDivElement | null) => void, children: React.ReactNode }> = ({ id, onRef, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id });

    return (
        <div
            ref={(node) => { setNodeRef(node); onRef(node); }}
            className={cn(
                "bg-white shadow-[0_60px_100px_-20px_rgba(0,0,0,0.5)] relative border transition-all duration-300",
                isOver ? "border-blue-500 ring-4 ring-blue-500/20 scale-[1.02]" : "border-slate-800"
            )}
            style={{ width: '210mm', minHeight: '120mm', position: 'relative' }}
        >
            {children}
        </div>
    );
};

interface PdfEditorProps {
    onSave?: (layout: PdfV2Layout) => void;
    onExport?: (layout: PdfV2Layout) => void;
}
