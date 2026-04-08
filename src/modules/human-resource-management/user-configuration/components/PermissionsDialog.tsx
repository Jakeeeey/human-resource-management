"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
    Shield, 
    Lock 
} from "lucide-react";
import { 
    SubsystemRegistration,
    ModuleRegistration,
} from "@/modules/human-resource-management/subsystem-registration/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PermissionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: { full_name: string; user_id: string } | null;
    subsystem: SubsystemRegistration | null;
    authorizedSubsystemIds: number[];
    authorizedModuleIds: number[]; // Current list of authorized module IDs
    onUpdate: (userId: string, authorizedSubsystemIds: number[], authorizedModuleIds: number[]) => void;
}

import { extractAllIds } from "@/modules/human-resource-management/user-configuration/utils/permissionUtils";

export function PermissionsDialog({
    open,
    onOpenChange,
    user,
    subsystem,
    authorizedSubsystemIds,
    authorizedModuleIds,
    onUpdate,
}: PermissionsDialogProps) {
    const [localSubsystems, setLocalSubsystems] = React.useState<number[]>([]);
    const [localModules, setLocalModules] = React.useState<number[]>([]);

    React.useEffect(() => {
        if (open) {
            setLocalSubsystems(authorizedSubsystemIds);
            setLocalModules(authorizedModuleIds);
        }
    }, [open, authorizedSubsystemIds, authorizedModuleIds]);

    if (!user || !subsystem) return null;

    const toggleItem = (id: number, checked: boolean, item?: SubsystemRegistration | ModuleRegistration, parentIds: number[] = []) => {
        const idsToToggle = item ? extractAllIds(item) : [id];

        if (checked) {
            // Recursive ON: Enable target + all children + all parents in path
            setLocalModules(prev => Array.from(new Set([...prev, ...idsToToggle, ...parentIds])));
        } else {
            // Recursive OFF: Disable target + all children
            setLocalModules(prev => prev.filter(i => !idsToToggle.includes(i)));
        }
    };
    
    const handleSubsystemToggle = (checked: boolean) => {
        if (!subsystem) return;
        const subId = Number(subsystem.id);
        
        if (checked) {
            setLocalSubsystems(prev => Array.from(new Set([...prev, subId])));
        } else {
            setLocalSubsystems(prev => prev.filter(id => id !== subId));
            
            // CLEANUP: Extract IDs from modules ONLY to keep them separate from the subsystem ID
            const allModuleIds: number[] = [];
            subsystem.modules?.forEach(mod => {
                allModuleIds.push(...extractAllIds(mod));
            });
            setLocalModules(prev => prev.filter(id => !allModuleIds.includes(id)));
        }
    };

    const handleSelectAllModules = () => {
        if (!subsystem) return;
        const subId = Number(subsystem.id);
        
        // COLLECT: Only from modules branch of the registry tree
        const moduleIdsToSelect: number[] = [];
        subsystem.modules?.forEach(mod => {
            moduleIdsToSelect.push(...extractAllIds(mod));
        });
        
        setLocalSubsystems(prev => Array.from(new Set([...prev, subId])));
        setLocalModules(prev => Array.from(new Set([...prev, ...moduleIdsToSelect])));
    };

    const handleClearAllModules = () => {
        if (!subsystem) return;
        
        // COLLECT: Only from modules branch
        const moduleIdsToClear: number[] = [];
        subsystem.modules?.forEach(mod => {
            moduleIdsToClear.push(...extractAllIds(mod));
        });
        
        setLocalModules(prev => prev.filter(id => !moduleIdsToClear.includes(id)));
    };

    const handleSave = () => {
        onUpdate(user.user_id, localSubsystems, localModules);
        onOpenChange(false);
    };

    const isSubsystemChecked = localSubsystems.includes(Number(subsystem.id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[650px] h-[75vh] sm:h-[85vh] flex flex-col overflow-hidden rounded-2xl border shadow-2xl bg-background">
                <DialogHeader className="p-5 pb-3 border-b bg-muted/20 shrink-0 flex-none">
                    <DialogTitle className="flex items-center gap-2 text-lg font-black tracking-tight">
                        <Shield className="h-5 w-5 text-primary" />
                        Permissions: {user.full_name}
                    </DialogTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wider">
                        Configuring <span className="font-bold text-primary">{subsystem.title}</span> Access
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden min-h-0">
                    <ScrollArea className="h-full w-full px-5 py-0">
                        <div className="space-y-3">
                            <div className="flex items-center space-x-3 p-3 rounded-xl border bg-primary/[0.02] border-primary/10 shadow-sm leading-tight transition-all">
                                <Switch 
                                    id="subsystem-access" 
                                    checked={isSubsystemChecked}
                                    onCheckedChange={handleSubsystemToggle}
                                />
                                <div className="grid gap-0.5 pointer-events-none">
                                    <label
                                        htmlFor="subsystem-access"
                                        className="text-xs font-bold leading-none cursor-pointer"
                                    >
                                        Enable Subsystem Access
                                    </label>
                                    <p className="text-[10px] text-muted-foreground font-medium">
                                        Primary entry point for this system.
                                    </p>
                                </div>
                            </div>

                            {!isSubsystemChecked && (
                                <div className="text-center py-10 bg-muted/5 rounded-2xl border border-dashed border-muted-foreground/20">
                                    <Lock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                                    <p className="text-[11px] text-muted-foreground font-medium">Enable access to configure specific modules.</p>
                                </div>
                            )}

                            {isSubsystemChecked && (
                                <div className="space-y-4 pl-0.5">
                                    <div className="flex items-center justify-between border-b pb-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Modules & Sub-modules</h4>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={handleSelectAllModules}
                                                className="text-[9px] font-black text-primary/60 hover:text-primary hover:underline underline-offset-2 tracking-widest transition-all"
                                            >
                                                SELECT ALL
                                            </button>
                                            <div className="h-2 w-[1px] bg-muted-foreground/20" />
                                            <button 
                                                onClick={handleClearAllModules}
                                                className="text-[9px] font-black text-muted-foreground hover:text-destructive transition-colors tracking-widest"
                                            >
                                                CLEAR ALL
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        {subsystem.modules?.map((module) => (
                                            <ModulePermissionItem
                                                key={module.id}
                                                module={module}
                                                authorizedModuleIds={localModules}
                                                parentIds={[]}
                                                onToggle={(id, checked, item, path) => toggleItem(id, checked, item, path)}
                                            />
                                        ))}
                                        {(!subsystem.modules || subsystem.modules.length === 0) && (
                                            <p className="text-xs italic text-muted-foreground py-4 text-center">No modules defined for this subsystem.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-5 py-4 border-t bg-muted/10 shrink-0 flex-none flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 px-4 rounded-xl text-xs font-bold opacity-60 hover:opacity-100">CANCEL</Button>
                    <Button onClick={handleSave} className="h-9 px-8 rounded-xl font-black shadow-xl shadow-primary/20 bg-primary text-xs tracking-widest">APPLY</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModulePermissionItem({ 
    module, 
    authorizedModuleIds, 
    parentIds,
    onToggle 
}: { 
    module: ModuleRegistration; 
    authorizedModuleIds: number[]; 
    parentIds: number[];
    onToggle: (id: number, checked: boolean, item?: ModuleRegistration, parentIds?: number[]) => void 
}) {
    const moduleId = Number(module.id);
    const isChecked = authorizedModuleIds.includes(moduleId);
    const hasChildren = module.subModules && module.subModules.length > 0;
    
    // Check if all children are checked
    const allChildrenChecked = hasChildren && module.subModules?.every(s => authorizedModuleIds.includes(Number(s.id)));

    return (
        <div className="space-y-2">
            <div className="flex items-center space-x-3 group">
                <Switch 
                    id={`module-${module.id}`} 
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(moduleId, !!checked, module, parentIds)}
                />
                <label
                    htmlFor={`module-${module.id}`}
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                >
                    {module.title}
                </label>
                
                {isChecked && hasChildren && (
                    <button 
                        onClick={() => {
                            if (allChildrenChecked) {
                                // Clear children except current module
                                onToggle(moduleId, false, module);
                                onToggle(moduleId, true); // Keep parent
                            } else {
                                // Select all children
                                onToggle(moduleId, true, module, parentIds);
                            }
                        }}
                        className="text-[8px] font-black text-primary/40 hover:text-primary transition-colors tracking-tighter uppercase whitespace-nowrap bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/10 ml-2"
                    >
                        {allChildrenChecked ? "Unselect All" : "Select All"}
                    </button>
                )}
            </div>

            {isChecked && hasChildren && (
                <div className="pl-6 space-y-3 border-l-2 ml-1.5 py-1">
                    {module.subModules?.map((sub) => (
                        <ModulePermissionItem
                            key={sub.id}
                            module={sub}
                            authorizedModuleIds={authorizedModuleIds}
                            parentIds={[...parentIds, moduleId]}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

