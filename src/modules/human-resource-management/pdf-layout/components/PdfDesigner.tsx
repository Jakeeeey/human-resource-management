"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Rnd } from "react-rnd";
import { PdfConfig, CompanyData, PdfElementConfig } from "../types";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";

interface PdfDesignerProps {
    config: PdfConfig;
    setConfig: React.Dispatch<React.SetStateAction<PdfConfig>>;
    data: CompanyData | null;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    saveHistory: () => void;
}

export const PdfDesigner: React.FC<PdfDesignerProps> = ({ config, setConfig, data, selectedId, setSelectedId, saveHistory }) => {
    const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
    const viewportRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollPos({
            x: e.currentTarget.scrollLeft,
            y: e.currentTarget.scrollTop
        });
    };

    const { paperSize, customSize, orientation, elements, showGrid, snapToGrid } = config;
    const baseSize = paperSize === 'Custom' ? customSize : PAPER_SIZES[paperSize];
    
    const widthMm = orientation === 'landscape' ? baseSize.height : baseSize.width;
    const heightMm = orientation === 'landscape' ? baseSize.width : baseSize.height;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedId) return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const step = e.shiftKey ? 5 : 1;
            let dx = 0;
            let dy = 0;

            switch (e.key) {
                case 'ArrowUp': dy = -step; break;
                case 'ArrowDown': dy = step; break;
                case 'ArrowLeft': dx = -step; break;
                case 'ArrowRight': dx = step; break;
                default: return;
            }

            e.preventDefault();
            saveHistory();
            setConfig((prev) => {
                const el = prev.elements[selectedId];
                if (!el) return prev;
                
                const margins = prev.margins || { top: 10, bottom: 10, left: 10, right: 10 };
                const newX = Math.max(margins.left, Math.min(widthMm - margins.right - el.width, el.x + dx));
                const newY = Math.max(margins.top, Math.min(heightMm - margins.bottom - el.height, el.y + dy));

                return {
                    ...prev,
                    elements: {
                        ...prev.elements,
                        [selectedId]: {
                            ...el,
                            x: newX,
                            y: newY,
                        },
                    },
                };
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, setConfig, saveHistory, widthMm, heightMm]);

    if (!data) return null;

    const scale = 3.7795; // 96 DPI (96 points per inch / 25.4 mm)
    const widthPx = widthMm * scale;
    const heightPx = heightMm * scale;

    const gridStep = 5;

    const handleDragStop = (id: string, d: { x: number; y: number }) => {
        setConfig((prev) => {
            const el = prev.elements[id];
            const margins = prev.margins || { top: 10, bottom: 10, left: 10, right: 10 };
            
            // Clamp to margins
            const xMm = Math.max(margins.left, Math.min(widthMm - margins.right - el.width, d.x / scale));
            const yMm = Math.max(margins.top, Math.min(heightMm - margins.bottom - el.height, d.y / scale));

            return {
                ...prev,
                elements: {
                    ...prev.elements,
                    [id]: {
                        ...el,
                        x: Math.round(xMm / (snapToGrid ? 1 : 0.1)) * (snapToGrid ? 1 : 0.1),
                        y: Math.round(yMm / (snapToGrid ? 1 : 0.1)) * (snapToGrid ? 1 : 0.1),
                    },
                },
            };
        });
    };

    const handleResizeStop = (id: string, ref: HTMLElement, position: { x: number; y: number }) => {
        setConfig((prev) => {
            const el = prev.elements[id];
            const margins = prev.margins || { top: 10, bottom: 10, left: 10, right: 10 };
            
            // Initial measurements in mm
            let xMm = position.x / scale;
            let yMm = position.y / scale;
            let wMm = ref.offsetWidth / scale;
            let hMm = ref.offsetHeight / scale;

            // Clamp to margins
            xMm = Math.max(margins.left, xMm);
            yMm = Math.max(margins.top, yMm);
            wMm = Math.min(wMm, widthMm - margins.right - xMm);
            hMm = Math.min(hMm, heightMm - margins.bottom - yMm);

            return {
                ...prev,
                elements: {
                    ...prev.elements,
                    [id]: {
                        ...el,
                        width: wMm,
                        height: hMm,
                        x: xMm,
                        y: yMm,
                    },
                },
            };
        });
    };

    const getElementDisplayValue = (el: PdfElementConfig): string => {
        if (el.type === 'custom_text') return el.content || 'Custom Text';
        switch (el.id) {
            case 'company_name': return data.company_name || 'Company Name';
            case 'company_address': return data.company_address || 'Address';
            case 'company_brgy': return data.company_brgy || 'Barangay';
            case 'company_city': return data.company_city || 'City';
            case 'company_province': return data.company_province || 'Province';
            case 'company_zipCode': return data.company_zipCode || 'Zip Code';
            case 'company_contact': return data.company_contact || '09123456789';
            case 'company_email': return data.company_email || 'email@company.com';
            default: return '';
        }
    };

    return (
        <div className="flex-1 bg-slate-200 flex flex-col relative overflow-hidden select-none" onClick={() => setSelectedId(null)}>
            {/* Top Ruler Row (Photoshop Layout) */}
            <div className="flex h-8 bg-white border-b border-slate-300 shrink-0 z-30">
                {/* Corner origin */}
                <div className="w-8 h-8 flex items-center justify-center bg-slate-50 border-r border-slate-300 shrink-0 text-[8px] text-slate-400 font-bold uppercase">
                    mm
                </div>
                {/* Horizontal Ruler Synced Scroll */}
                <div className="flex-1 relative overflow-hidden h-full">
                    <div className="absolute top-0 flex h-full" style={{ left: 48 - scrollPos.x }}>
                        {Array.from({ length: Math.ceil(widthMm) + 1 }).map((_, i) => {
                            const isMajor = i % 10 === 0;
                            const isMid = i % 5 === 0;
                            return (
                                <div key={i} className="absolute bottom-0 flex flex-col items-center" style={{ left: i * scale }}>
                                    <div className={`bg-slate-400 ${isMajor ? 'h-4 w-[1px]' : isMid ? 'h-3 w-[1px]' : 'h-1.5 w-[0.5px]'}`}></div>
                                    {isMajor && (
                                        <span className="text-[7px] text-slate-500 absolute -top-1 translate-y-[-100%]">{i}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Side Ruler Gutter (Photoshop Layout) */}
                <div className="w-8 bg-white border-r border-slate-300 shrink-0 z-20 relative overflow-hidden">
                    <div className="absolute left-0 w-full" style={{ top: 48 - scrollPos.y }}>
                        {Array.from({ length: Math.ceil(heightMm) + 1 }).map((_, i) => {
                            const isMajor = i % 10 === 0;
                            const isMid = i % 5 === 0;
                            return (
                                <div key={i} className="absolute right-0 flex items-center pr-1" style={{ top: i * scale }}>
                                    {isMajor && (
                                        <span className="text-[7px] text-slate-500 leading-none mr-1">{i}</span>
                                    )}
                                    <div className={`bg-slate-400 ${isMajor ? 'w-4 h-[1px]' : isMid ? 'w-3 h-[1px]' : 'w-1.5 h-[0.5px]'}`}></div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main Viewport Area (Scrollable) */}
                <div 
                    ref={viewportRef}
                    className="flex-1 overflow-auto p-12 custom-scrollbar bg-slate-200"
                    onScroll={handleScroll}
                >
                    <div 
                        className="bg-white shadow-2xl relative outline outline-1 outline-slate-300"
                        style={{ width: widthPx, height: heightPx, minWidth: widthPx, minHeight: heightPx }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Visual Grid */}
                        {showGrid && (
                            <div className="absolute inset-0 pointer-events-none opacity-[0.05]" 
                                 style={{ 
                                     backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                                     backgroundSize: `${gridStep * scale}px ${gridStep * scale}px` 
                                 }}></div>
                        )}

                        {/* Page Margins Guides (Acts as Safe Zone) */}
                        <div id="pdf-safe-zone" className="absolute pointer-events-none border border-red-500/20" 
                             style={{ 
                                 top: (config.margins?.top || 0) * scale, 
                                 bottom: (config.margins?.bottom || 0) * scale, 
                                 left: (config.margins?.left || 0) * scale, 
                                 right: (config.margins?.right || 0) * scale 
                             }}></div>
                        
                        {/* Body Boundary Indicators */}
                        {config.bodyStart !== undefined && (
                            <div className="absolute left-0 right-0 z-40 group cursor-ns-resize"
                                 style={{ top: config.bodyStart * scale - 10, height: 20 }}
                                 onMouseDown={(e) => {
                                     e.stopPropagation();
                                     saveHistory();
                                     const startY = e.clientY;
                                     const startVal = config.bodyStart || 0;
                                     const onMouseMove = (moveEvent: MouseEvent) => {
                                         const deltaY = (moveEvent.clientY - startY) / scale;
                                         const margins = config.margins || { top: 10, bottom: 10 };
                                         let newVal = Math.max(margins.top, Math.min(heightMm - margins.bottom, startVal + deltaY));
                                         if (snapToGrid) newVal = Math.round(newVal);
                                         setConfig(prev => ({ ...prev, bodyStart: Number(newVal.toFixed(1)) }));
                                     };
                                     const onMouseUp = () => {
                                         window.removeEventListener('mousemove', onMouseMove);
                                         window.removeEventListener('mouseup', onMouseUp);
                                     };
                                     window.addEventListener('mousemove', onMouseMove);
                                     window.addEventListener('mouseup', onMouseUp);
                                 }}>
                                <div className="w-full border-t-2 border-green-500/60 border-dashed mt-2.5"></div>
                                <span className="absolute left-1 top-5 text-[9px] text-green-600 font-bold bg-white/90 px-1 rounded shadow-sm border border-green-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    BODY START: {config.bodyStart}mm (DRAG TO MOVE)
                                </span>
                            </div>
                        )}
                        {config.bodyEnd !== undefined && (
                            <div className="absolute left-0 right-0 z-40 group cursor-ns-resize"
                                 style={{ top: config.bodyEnd * scale - 10, height: 20 }}
                                 onMouseDown={(e) => {
                                     e.stopPropagation();
                                     saveHistory();
                                     const startY = e.clientY;
                                     const startVal = config.bodyEnd || 0;
                                     const onMouseMove = (moveEvent: MouseEvent) => {
                                         const deltaY = (moveEvent.clientY - startY) / scale;
                                         const margins = config.margins || { top: 10, bottom: 10 };
                                         let newVal = Math.max(margins.top, Math.min(heightMm - margins.bottom, startVal + deltaY));
                                         if (snapToGrid) newVal = Math.round(newVal);
                                         setConfig(prev => ({ ...prev, bodyEnd: Number(newVal.toFixed(1)) }));
                                     };
                                     const onMouseUp = () => {
                                         window.removeEventListener('mousemove', onMouseMove);
                                         window.removeEventListener('mouseup', onMouseUp);
                                     };
                                     window.addEventListener('mousemove', onMouseMove);
                                     window.addEventListener('mouseup', onMouseUp);
                                 }}>
                                <div className="w-full border-t-2 border-orange-500/60 border-dashed mt-2.5"></div>
                                <span className="absolute left-1 top-5 text-[9px] text-orange-600 font-bold bg-white/90 px-1 rounded shadow-sm border border-orange-100 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    BODY END: {config.bodyEnd}mm (DRAG TO MOVE)
                                </span>
                            </div>
                        )}

                        {/* Draggable Essentials */}
                        {Object.values(elements).map((el) => {
                            if (!el.visible) return null;
                            const isSelected = selectedId === el.id;
                            
                            return (
                                <Rnd
                                    key={el.id}
                                    size={{ 
                                        width: el.width * scale, 
                                        height: (el.type === 'shape' && el.shapeType === 'line') ? (el.borderWidth || 0.1) * scale : el.height * scale 
                                    }}
                                    position={{ x: el.x * scale, y: el.y * scale }}
                                    onDragStart={() => {
                                        setSelectedId(el.id);
                                        saveHistory();
                                    }}
                                    onDragStop={(e, d) => handleDragStop(el.id, d)}
                                    onResizeStart={() => {
                                        setSelectedId(el.id);
                                        saveHistory();
                                    }}
                                    onResizeStop={(e, direction, ref, delta, position) => handleResizeStop(el.id, ref, position)}
                                    bounds="#pdf-safe-zone"
                                    dragGrid={[snapToGrid ? scale : 1, snapToGrid ? scale : 1]}
                                    resizeGrid={[snapToGrid ? scale : 1, snapToGrid ? scale : 1]}
                                    enableResizing={true}
                                    style={{ zIndex: isSelected ? 50 : 10 }}
                                >
                                    <div 
                                        onClick={() => setSelectedId(el.id)}
                                        className={`relative h-full w-full transition-all group cursor-move
                                            ${(el.type !== 'shape' || el.shapeType !== 'line') ? 'border' : ''}
                                            ${isSelected ? 'border-blue-500 border-2 bg-blue-50/10 shadow-lg' : 'border-dashed border-blue-200/50 hover:border-blue-500/50 hover:bg-blue-50/5'}
                                            ${(el.type === 'text' || el.type === 'custom_text') ? 
                                                (el.align === 'center' ? 'flex justify-center items-center text-center' : 
                                                 el.align === 'right' ? 'flex justify-end items-center text-right' : 'flex justify-start items-center text-left') 
                                                : ''}`}
                                        style={{
                                            fontSize: `${el.style.fontSize * (25.4 / 72) * scale}px`,
                                            fontFamily: el.style.fontFamily,
                                            fontWeight: el.style.fontWeight,
                                            color: el.style.color,
                                            letterSpacing: `${(el.style.letterSpacing || 0) * scale}px`,
                                            lineHeight: el.style.lineHeight || 1.15,
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
                                            textAlign: el.align,
                                            backgroundColor: el.type === 'shape' && el.shapeType === 'rectangle' ? el.fillColor : 'transparent',
                                            borderWidth: (el.type === 'shape' && el.shapeType === 'rectangle') ? `${(el.borderWidth || 1) * scale}px` : '1px',
                                            borderColor: isSelected ? '#3b82f6' : (el.type === 'shape' && el.shapeType === 'line') ? 'transparent' : (el.borderColor || '#cbd5e1'),
                                            borderStyle: el.type === 'shape' && el.shapeType === 'rectangle' ? 'solid' : 'dashed',
                                            boxSizing: 'border-box',
                                        }}
                                    >
                                        {el.type === 'image' && (
                                            <Image 
                                                src={(el.id === 'company_logo' ? data?.company_logo : (data as unknown as Record<string, string>)?.[el.id]) || el.content || ''} 
                                                alt={el.label} 
                                                fill
                                                unoptimized
                                                className="object-fill pointer-events-none" 
                                            />
                                        )}
                                        {el.type === 'shape' && el.shapeType === 'line' && (
                                            <div 
                                                className="w-full pointer-events-none" 
                                                style={{ 
                                                    height: `${(el.borderWidth || 1) * scale}px`, 
                                                    backgroundColor: el.borderColor || '#000000' 
                                                }} 
                                            />
                                        )}
                                        {(el.type === 'text' || el.type === 'custom_text') && (
                                            <div className="w-full pointer-events-none whitespace-nowrap overflow-hidden">
                                                {getElementDisplayValue(el)}
                                            </div>
                                        )}
                                        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] px-1 py-0.5 rounded transition-opacity whitespace-nowrap z-50 shadow-sm pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                            {el.label}
                                        </div>
                                    </div>
                                </Rnd>
                            );
                        })}

                        {/* Page Number Preview */}
                        {config.pageNumber?.show && (
                            <div 
                                className="absolute pointer-events-none"
                                style={{
                                    fontSize: `${(config.pageNumber.fontSize || 9) * (25.4 / 72) * scale}px`,
                                    fontFamily: config.pageNumber.fontFamily || 'helvetica',
                                    color: config.pageNumber.color || '#64748b',
                                    ...(() => {
                                        const mY = (config.pageNumber.marginY || 5) * scale;
                                        const mX = (config.pageNumber.marginX || 10) * scale;
                                        switch (config.pageNumber.position) {
                                            case 'bottom-left': return { bottom: mY, left: mX, textAlign: 'left' };
                                            case 'bottom-center': return { bottom: mY, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' as const };
                                            case 'bottom-right': return { bottom: mY, right: mX, textAlign: 'right' };
                                            case 'top-left': return { top: mY, left: mX, textAlign: 'left' };
                                            case 'top-center': return { top: mY, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' as const };
                                            case 'top-right': return { top: mY, right: mX, textAlign: 'right' };
                                            default: return { bottom: mY, right: mX, textAlign: 'right' };
                                        }
                                    })()
                                }}
                            >
                                {(config.pageNumber.format || 'Page {pageNumber} of {totalPages}').replace('{pageNumber}', '1').replace('{totalPages}', '1')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
