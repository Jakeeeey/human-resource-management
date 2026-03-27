"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    Plus, 
    Trash2, 
    ChevronRight, 
    ChevronDown, 
    Package, 
    Layers
} from "lucide-react";
import { 
    SubsystemRegistration, 
    ModuleRegistration, 
    SubModuleRegistration 
} from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SubsystemHierarchyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subsystem: SubsystemRegistration | null;
    onUpdate: (updatedSubsystem: SubsystemRegistration) => void;
}

export function SubsystemHierarchyDialog({
    open,
    onOpenChange,
    subsystem,
    onUpdate,
}: SubsystemHierarchyDialogProps) {
    const [modules, setModules] = React.useState<ModuleRegistration[]>([]);

    React.useEffect(() => {
        if (subsystem) {
            setModules(subsystem.modules || []);
        }
    }, [subsystem, open]);

    if (!subsystem) return null;

    const handleAddModule = () => {
        const newModule: ModuleRegistration = {
            id: Math.random().toString(36).substr(2, 9),
            slug: "",
            title: "New Module",
            base_path: "",
            status: "active",
            subModules: [],
        };
        setModules([...modules, newModule]);
    };

    const handleUpdateModule = (moduleId: string, data: Partial<ModuleRegistration>) => {
        setModules(modules.map(m => m.id === moduleId ? { ...m, ...data } : m));
    };

    const handleDeleteModule = (moduleId: string) => {
        setModules(modules.filter(m => m.id !== moduleId));
    };

    const handleAddSubModule = (moduleId: string) => {
        setModules(modules.map(m => {
            if (m.id === moduleId) {
                const newSub: SubModuleRegistration = {
                    id: Math.random().toString(36).substr(2, 9),
                    slug: "",
                    title: "New Sub-module",
                    base_path: "",
                    status: "active",
                };
                return { ...m, subModules: [...m.subModules, newSub] };
            }
            return m;
        }));
    };

    const handleUpdateSubModule = (moduleId: string, subModuleId: string, data: Partial<SubModuleRegistration>) => {
        setModules(modules.map(m => {
            if (m.id === moduleId) {
                return {
                    ...m,
                    subModules: m.subModules.map(s => s.id === subModuleId ? { ...s, ...data } : s)
                };
            }
            return m;
        }));
    };

    const handleDeleteSubModule = (moduleId: string, subModuleId: string) => {
        setModules(modules.map(m => {
            if (m.id === moduleId) {
                return {
                    ...m,
                    subModules: m.subModules.filter(s => s.id !== subModuleId)
                };
            }
            return m;
        }));
    };

    const handleSave = () => {
        onUpdate({ ...subsystem, modules });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Hierarchy Management: {subsystem.title}
                    </DialogTitle>
                </DialogHeader>
                
                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Modules & Sub-modules
                            </h3>
                            <Button size="sm" onClick={handleAddModule} variant="outline" className="h-8">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Module
                            </Button>
                        </div>

                        {modules.length === 0 && (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                                <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">No modules registered yet.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {modules.map((module) => (
                                <ModuleItem
                                    key={module.id}
                                    module={module}
                                    onUpdate={(data) => handleUpdateModule(module.id, data)}
                                    onDelete={() => handleDeleteModule(module.id)}
                                    onAddSubModule={() => handleAddSubModule(module.id)}
                                    onUpdateSubModule={(sid, data) => handleUpdateSubModule(module.id, sid, data)}
                                    onDeleteSubModule={(sid) => handleDeleteSubModule(module.id, sid)}
                                />
                            ))}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/10">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Hierarchy</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModuleItem({ 
    module, 
    onUpdate, 
    onDelete, 
    onAddSubModule,
    onUpdateSubModule,
    onDeleteSubModule
}: { 
    module: ModuleRegistration;
    onUpdate: (data: Partial<ModuleRegistration>) => void;
    onDelete: () => void;
    onAddSubModule: () => void;
    onUpdateSubModule: (id: string, data: Partial<SubModuleRegistration>) => void;
    onDeleteSubModule: (id: string) => void;
}) {
    const [isExpanded, setIsExpanded] = React.useState(true);

    return (
        <div className="border rounded-lg bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
                <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input 
                        placeholder="Module Title" 
                        value={module.title}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                        className="h-8 text-sm font-semibold" 
                    />
                    <Input 
                        placeholder="Path (e.g. /hr/admin)" 
                        value={module.base_path}
                        onChange={(e) => onUpdate({ base_path: e.target.value })}
                        className="h-8 text-xs font-mono" 
                    />
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-4 bg-background/50 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Sub-modules</span>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={onAddSubModule}>
                            <Plus className="mr-1 h-3 w-3" />
                            Add Sub-module
                        </Button>
                    </div>
                    
                    <div className="space-y-2 pl-4 border-l-2 ml-3">
                        {module.subModules.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 group">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <Input 
                                        placeholder="Sub-module Title" 
                                        value={sub.title}
                                        onChange={(e) => onUpdateSubModule(sub.id, { title: e.target.value })}
                                        className="h-7 text-xs" 
                                    />
                                    <Input 
                                        placeholder="Path (e.g. /hr/admin/sched)" 
                                        value={sub.base_path}
                                        onChange={(e) => onUpdateSubModule(sub.id, { base_path: e.target.value })}
                                        className="h-7 text-[10px] font-mono" 
                                    />
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => onDeleteSubModule(sub.id)}
                                >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        {module.subModules.length === 0 && (
                            <p className="text-[10px] italic text-muted-foreground py-2">No sub-modules assigned. This module will appear as a direct link in the sidebar.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
