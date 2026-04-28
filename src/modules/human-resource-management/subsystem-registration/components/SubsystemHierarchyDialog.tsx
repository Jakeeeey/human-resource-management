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
import { 
    Plus, 
    Trash2, 
    ChevronRight, 
    ChevronDown, 
    Package, 
    Layers,
    Link as LinkIcon,
    Search,
    Maximize2,
    Minimize2,
    Loader2,
    ArrowUp,
    ArrowDown,
} from "lucide-react";
import { 
    SubsystemRegistration, 
    ModuleRegistration, 
} from "../types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { IconPicker } from "./IconPicker";
import { APP_SIDEBAR_REFRESH_EVENT } from "@/components/shared/app-sidebar/app-sidebar-events";
import { toast } from "sonner";

interface SubsystemHierarchyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subsystem: SubsystemRegistration | null;
    onUpdate: (updatedSubsystem: SubsystemRegistration) => Promise<{ success: boolean; message?: string }>;
}

export function SubsystemHierarchyDialog({
    open,
    onOpenChange,
    subsystem,
    onUpdate,
}: SubsystemHierarchyDialogProps) {
    const [modules, setModules] = React.useState<ModuleRegistration[]>([]);
    const [searchQuery, setSearchQuery] = React.useState("");
    const [expandedIds, setExpandedIds] = React.useState<Set<string | number>>(new Set());
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (subsystem && open) {
            setModules(subsystem.modules || []);
            // Initially expand root modules
            const rootIds = (subsystem.modules || []).map(m => m.id);
            setExpandedIds(new Set(rootIds));
        }
    }, [subsystem, open]);

    // Helper: Counts modules in tree
    const countModules = (items: ModuleRegistration[]): { total: number; active: number } => {
        return items.reduce((acc, item) => {
            const childrenCount = item.subModules ? countModules(item.subModules) : { total: 0, active: 0 };
            return {
                total: acc.total + 1 + childrenCount.total,
                active: acc.active + (item.status === 'active' ? 1 : 0) + childrenCount.active
            };
        }, { total: 0, active: 0 });
    };

    const stats = countModules(modules);

    // Recursive helper to update an item in the tree
    const updateInTree = (items: ModuleRegistration[], id: string | number, updater: (item: ModuleRegistration) => ModuleRegistration | null): ModuleRegistration[] => {
        return items.reduce((acc, item) => {
            if (item.id === id) {
                const updated = updater(item);
                if (updated) acc.push(updated);
                return acc;
            }
            if (item.subModules) {
                acc.push({
                    ...item,
                    subModules: updateInTree(item.subModules, id, updater)
                });
                return acc;
            }
            acc.push(item);
            return acc;
        }, [] as ModuleRegistration[]);
    };

    const handleAddRootModule = () => {
        if (!subsystem) return;
        const newModule: ModuleRegistration = {
            id: Math.random().toString(36).substr(2, 9),
            slug: "",
            title: "New Module",
            base_path: `${subsystem.base_path}/new-module`,
            status: "active",
            icon_name: "Folder",
            subModules: [],
        };
        setModules([...modules, newModule]);
        setExpandedIds(prev => new Set(prev).add(newModule.id));
    };

    const handleUpdateItem = (id: string | number, data: Partial<ModuleRegistration>, parentPath: string = "") => {
        const generateSlug = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

        // Helper: Recursively updates base_path for all children when parent path changes
        const updateChildrenPaths = (items: ModuleRegistration[], newParentPath: string): ModuleRegistration[] => {
            return items.map(child => {
                const childSlug = child.slug || generateSlug(child.title);
                const newPath = `${newParentPath}/${childSlug}`;
                return {
                    ...child,
                    base_path: newPath,
                    subModules: child.subModules ? updateChildrenPaths(child.subModules, newPath) : []
                };
            });
        };

        setModules(prev => updateInTree(prev, id, item => {
            const updated = { ...item, ...data };

            // Logic: If title changed and no manual path provided, update slug and path
            if (data.title && !data.base_path) {
                const slug = generateSlug(data.title);
                updated.slug = slug;
                updated.base_path = `${parentPath}/${slug}`;
            }

            // Logic: If path or title (slug) changed, update all descendants
            if (updated.base_path !== item.base_path && updated.subModules && updated.subModules.length > 0) {
                updated.subModules = updateChildrenPaths(updated.subModules, updated.base_path);
            }

            return updated;
        }));
    };

    const handleDeleteItem = (id: string | number) => {
        setModules(prev => updateInTree(prev, id, () => null));
    };

    const handleAddChild = (parentId: string | number, parentPath: string) => {
        const newId = Math.random().toString(36).substr(2, 9);
        setModules(prev => updateInTree(prev, parentId, item => ({
            ...item,
            subModules: [
                ...(item.subModules || []),
                {
                    id: newId,
                    slug: "new-sub-module",
                    title: "New Sub-module",
                    base_path: `${parentPath}/new-sub-module`,
                    status: "active",
                    icon_name: "Folder",
                    subModules: [],
                }
            ]
        })));
        setExpandedIds(prev => new Set(prev).add(parentId));
    };

    const toggleExpand = (id: string | number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleMoveItem = (id: string | number, direction: 'up' | 'down') => {
        const move = (items: ModuleRegistration[]): ModuleRegistration[] => {
            const index = items.findIndex(m => m.id === id);
            if (index !== -1) {
                const newItems = [...items];
                const targetIndex = direction === 'up' ? index - 1 : index + 1;
                if (targetIndex >= 0 && targetIndex < newItems.length) {
                    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
                }
                return newItems;
            }
            return items.map(item => ({
                ...item,
                subModules: item.subModules ? move(item.subModules) : []
            }));
        };
        setModules(prev => move(prev));
    };

    const handleExpandAll = () => {
        const allIds = new Set<string | number>();
        const collect = (items: ModuleRegistration[]) => {
            items.forEach(item => {
                allIds.add(item.id);
                if (item.subModules) collect(item.subModules);
            });
        };
        collect(modules);
        setExpandedIds(allIds);
    };

    const handleCollapseAll = () => setExpandedIds(new Set());

    const findDuplicateSlugs = (items: ModuleRegistration[]): { title: string; parentTitle: string; slug: string } | null => {
        const slugs = new Set<string>();
        let duplicateInfo: { title: string; parentTitle: string; slug: string } | null = null;

        const traverse = (list: ModuleRegistration[], parentTitle: string = "Root") => {
            for (const item of list) {
                const s = item.slug || "";
                if (s && slugs.has(s)) {
                    duplicateInfo = { title: item.title, parentTitle, slug: s };
                    return;
                }
                slugs.add(s);
                if (item.subModules) traverse(item.subModules, item.title);
                if (duplicateInfo) return;
            }
        };

        traverse(items, "Root");
        return duplicateInfo;
    };

    const handleSave = async () => {
        if (!subsystem) return;

        // 1. Validation: Check for duplicates within this subsystem hierarchy
        const duplicate = findDuplicateSlugs(modules);
        if (duplicate) {
            toast.error("Duplicate Module Detected", {
                description: `The module "${duplicate.title}" already exists in the "${duplicate.parentTitle}" folder. Each module in this subsystem must have a unique slug.`,
                duration: 6000,
            });
            return;
        }

        setIsSaving(true);
        try {
            const result = await onUpdate({ ...subsystem, modules });
            if (result.success) {
                // Live Sync: Force refresh the sidebar navigation via Custom Event
                window.dispatchEvent(new CustomEvent(APP_SIDEBAR_REFRESH_EVENT));
                onOpenChange(false);
                // Success message is handled by the hook
            } else {
                // Error message is handled by the hook, but we can add more context here if needed
                console.error("Save failed:", result.message);
            }
        } catch (error) {
            console.error("Failed to save hierarchy:", error);
            toast.error("An unexpected connection error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    // Filter Logic for Tree (Side-effect free version)
    const filterTree = React.useCallback((items: ModuleRegistration[], query: string): ModuleRegistration[] => {
        if (!query) return items;
        return items.reduce<ModuleRegistration[]>((acc, item) => {
            const matchesSelf = item.title.toLowerCase().includes(query.toLowerCase()) ||
                              item.base_path.toLowerCase().includes(query.toLowerCase());
            const filteredChildren = item.subModules ? filterTree(item.subModules, query) : [];
            const matchesChildren = filteredChildren.length > 0;

            if (matchesSelf || matchesChildren) {
                acc.push({ ...item, subModules: matchesChildren ? filteredChildren : item.subModules });
            }
            return acc;
        }, []);
    }, []);

    const displayedModules = React.useMemo(() => {
        const cloned = JSON.parse(JSON.stringify(modules));
        return filterTree(cloned, searchQuery);
    }, [modules, searchQuery, filterTree]);

    // Expand search results automatically
    React.useEffect(() => {
        if (searchQuery) {
            const resultIds = new Set<string | number>();
            const collect = (items: ModuleRegistration[]) => {
                items.forEach(item => {
                    if (item.subModules && item.subModules.length > 0) {
                        resultIds.add(item.id);
                        collect(item.subModules);
                    }
                });
            };
            collect(displayedModules);
            setExpandedIds(prev => new Set([...prev, ...resultIds]));
        }
    }, [displayedModules, searchQuery]);

    if (!subsystem) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-[1000px] h-[95vh] sm:h-[90vh] max-h-[95vh] flex flex-col p-0 overflow-hidden bg-background border shadow-2xl rounded-2xl">
                <DialogHeader className="p-5 sm:p-6 pb-3 bg-muted/20 border-b">
                    <div className="flex items-center justify-between gap-6">
                        <div className="space-y-0.5">
                            <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl font-black tracking-tighter">
                                <span className="bg-primary/10 p-2 sm:p-2.5 rounded-2xl shadow-inner">
                                    <Layers className="h-5 w-5 text-primary" />
                                </span>
                                Hierarchy Management
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="rounded-md font-mono text-[9px] py-0 bg-primary/10 text-primary border-none">{subsystem.slug}</Badge>
                                <span className="text-xs font-bold text-muted-foreground/80">{subsystem.title}</span>
                            </div>
                        </div>

                        {/* Navigation Analytics for scalability */}
                        <div className="hidden lg:flex items-center gap-5 bg-card border rounded-2xl px-4 py-2.5 shadow-sm border-muted-foreground/10">
                            <div className="flex flex-col items-center gap-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Registry</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-primary">{stats.total}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/40">items</span>
                                </div>
                            </div>
                            <Separator orientation="vertical" className="h-5" />
                            <div className="flex flex-col items-center gap-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Live</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-green-600">{stats.active}</span>
                                    <span className="text-[9px] font-bold text-muted-foreground/40">active</span>
                                </div>
                            </div>
                             <Separator orientation="vertical" className="h-5" />
                             <div className="flex flex-col items-center gap-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Status</span>
                                <Badge className="mt-0.5 bg-green-500/10 text-green-600 border-green-500/20 text-[8px] py-0 px-1.5 font-black">STABLE</Badge>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-5">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                            <Input 
                                placeholder="Quick search tree..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 rounded-xl bg-muted/20 border-muted-foreground/10 focus-visible:ring-primary/20 backdrop-blur-sm transition-all text-xs font-medium"
                            />
                        </div>
                        <div className="flex items-center justify-between sm:justify-start bg-muted/30 p-1 rounded-xl gap-1 border">
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleExpandAll}
                                className="rounded-lg px-2 text-[10px] font-black uppercase tracking-wider text-primary h-7 sm:h-7"
                            >
                                <Maximize2 className="h-3 w-3 mr-1.5" /> Expand
                            </Button>
                            <Separator orientation="vertical" className="h-3" />
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleCollapseAll}
                                className="rounded-lg px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground h-7 sm:h-7"
                            >
                                <Minimize2 className="h-3 w-3 mr-1.5" /> Collapse
                            </Button>
                             <Separator orientation="vertical" className="h-3" />
                             <Button 
                                size="sm" 
                                onClick={handleAddRootModule} 
                                className="h-7 rounded-lg shadow-lg shadow-primary/10 gap-1.5 font-black text-[10px] uppercase tracking-wider bg-primary hover:bg-primary/90 px-3 transition-all hover:scale-105 active:scale-95"
                            >
                                <Plus className="h-3 w-3" />
                                New Module
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                
                <ScrollArea className="flex-1 min-h-0 px-4 sm:px-6 bg-gradient-to-b from-primary/[0.01] to-transparent">
                    <div className="space-y-4 pb-12 pt-4">
                        {modules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 sm:py-16 border-2 border-dashed rounded-2xl bg-muted/2 border-primary/20 shadow-inner px-6">
                                <div className="bg-primary/5 p-5 rounded-full mb-4">
                                    <Layers className="h-10 w-10 text-primary/30" />
                                </div>
                                <h4 className="text-base font-black text-foreground tracking-tight text-center">Empty Hierarchy</h4>
                                <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-medium max-w-[240px] text-center leading-relaxed">
                                    Add your first module to begin registry management.
                                </p>
                                <Button onClick={handleAddRootModule} className="mt-5 rounded-xl px-6 font-black shadow-xl shadow-primary/20 bg-primary h-9 text-[10px] uppercase tracking-wider">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Initialize Tree
                                </Button>
                            </div>
                        ) : displayedModules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-2xl bg-muted/5 border-muted-foreground/10 px-6">
                                <Package className="h-10 w-10 text-muted-foreground/10 mb-4" />
                                <h4 className="text-sm font-black text-muted-foreground/60 text-center">No results found</h4>
                                <Button onClick={() => setSearchQuery("")} variant="link" className="text-primary mt-2 font-bold text-xs">Clear search</Button>
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {displayedModules.map((module, index) => (
                                    <RecursiveModuleItem
                                        key={module.id}
                                        item={module}
                                        depth={0}
                                        parentPath={subsystem.base_path}
                                        expandedIds={expandedIds}
                                        onExpand={toggleExpand}
                                        onUpdate={handleUpdateItem}
                                        onDelete={handleDeleteItem}
                                        onAddChild={handleAddChild}
                                        onMove={handleMoveItem}
                                        isFirst={index === 0}
                                        isLast={index === displayedModules.length - 1}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="shrink-0 p-4 sm:p-5 py-3.5 border-t bg-muted/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)} 
                            className="flex-1 sm:flex-none rounded-xl px-6 font-bold h-9 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background"
                            disabled={isSaving}
                        >
                            CANCEL
                        </Button>
                        <Button 
                            onClick={handleSave} 
                            disabled={isSaving}
                            className="flex-1 sm:flex-none rounded-xl px-10 font-black shadow-xl shadow-primary/20 bg-primary h-9 text-[10px] uppercase tracking-wider"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Structure"
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface RecursiveModuleItemProps {
    item: ModuleRegistration;
    depth: number;
    parentPath: string;
    expandedIds: Set<string | number>;
    onExpand: (id: string | number) => void;
    onUpdate: (id: string | number, data: Partial<ModuleRegistration>, parentPath?: string) => void;
    onDelete: (id: string | number) => void;
    onAddChild: (id: string | number, parentPath: string) => void;
    onMove: (id: string | number, direction: 'up' | 'down') => void;
    isFirst: boolean;
    isLast: boolean;
}

function RecursiveModuleItem({ 
    item, 
    depth, 
    parentPath,
    expandedIds,
    onExpand,
    onUpdate, 
    onDelete, 
    onAddChild,
    onMove,
    isFirst,
    isLast
}: RecursiveModuleItemProps) {
    const isExpanded = expandedIds.has(item.id);
    const hasChildren = item.subModules && item.subModules.length > 0;
    const isRoot = depth === 0;

    return (
        <div className="relative group/module">
            {/* Ultra-Premium Connector Lines */}
            {!isRoot && (
                <>
                    <div className="absolute -left-6 top-[18px] w-6 h-[1px] bg-gradient-to-r from-muted-foreground/10 to-muted-foreground/30" />
                    <div className="absolute -left-6 -top-2 w-[1px] h-[calc(100%+8px)] bg-muted-foreground/10 group-last/module:h-[26px]" />
                </>
            )}

            <div className={cn(
                "relative flex items-center gap-3 p-1.5 pl-3 rounded-2xl border transition-all duration-300",
                isRoot 
                    ? "bg-card border-muted-foreground/10 shadow-sm mb-1" 
                    : "bg-muted/5 border-transparent hover:border-primary/20 hover:bg-primary/[0.01] hover:shadow-md hover:shadow-primary/5",
                item.status === 'comingSoon' && "opacity-75"
            )}>
                {/* Visual Level indicator */}
                <div className={cn(
                    "absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 rounded-full",
                    isRoot ? "h-5 bg-primary" : "h-2 bg-primary/20"
                )} />

                <div className="flex items-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                            "h-6 w-6 rounded-lg transition-all duration-300",
                            !hasChildren && "opacity-0 pointer-events-none w-1",
                            isExpanded ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                        )} 
                        onClick={() => onExpand(item.id)}
                    >
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                    <div className="shrink-0 scale-75 -mx-1">
                        <IconPicker 
                            value={item.icon_name || "Folder"} 
                            onChange={(v) => onUpdate(item.id, { icon_name: v })} 
                        />
                    </div>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                             <Input 
                                placeholder="Module Title" 
                                value={item.title}
                                onChange={(e) => onUpdate(item.id, { title: e.target.value }, parentPath)}
                                className={cn(
                                    "h-8 px-0 bg-transparent border-none shadow-none focus-visible:ring-0 font-bold tracking-tight truncate",
                                    isRoot ? "text-[13px] sm:text-sm text-foreground" : "text-[12px] sm:text-[13px] text-foreground/80"
                                )} 
                            />
                            <div 
                                className={cn(
                                    "shrink-0 px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black flex items-center gap-1 cursor-pointer select-none transition-all hover:scale-105 active:scale-95 border",
                                    item.status === 'active' 
                                        ? "bg-green-500/10 text-green-600 border-green-500/20" 
                                        : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                )}
                                onClick={() => onUpdate(item.id, { status: item.status === 'active' ? 'comingSoon' : 'active' })}
                            >
                                <span className={cn("h-1 w-1 rounded-full", item.status === 'active' ? "bg-green-600" : "bg-orange-600")} />
                                {item.status === 'active' ? 'LIVE' : 'SOON'}
                            </div>
                        </div>
                    </div>

                    <div className="group/path w-full sm:w-[260px] flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-transparent hover:border-primary/20 hover:bg-card transition-all overflow-hidden">
                        <LinkIcon className="h-3 w-3 text-primary/40 ml-1 shrink-0" />
                        <Input 
                            value={item.base_path}
                            onChange={(e) => onUpdate(item.id, { base_path: e.target.value })}
                            className="h-6 px-0 bg-transparent border-none shadow-none focus-visible:ring-0 font-mono text-[9px] sm:text-[10px] font-bold text-muted-foreground/70 truncate" 
                        />
                    </div>
                </div>

                {/* Move Controls & Actions */}
                <div className="flex items-center gap-1 pl-1 sm:pl-2 transition-all duration-300">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 sm:h-7 sm:w-7 rounded-xl text-primary hover:bg-primary/10 active:scale-90 transition-all" 
                        title="Add child element"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddChild(item.id, item.base_path);
                        }}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-4 mx-0 sm:mx-0.5 opacity-10" />
                    <div className="flex bg-muted/60 p-0.5 rounded-xl border border-divider">
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isFirst}
                            className="h-6 w-6 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-30 active:scale-90" 
                            onClick={() => onMove(item.id, 'up')}
                        >
                            <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled={isLast}
                            className="h-6 w-6 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-30 active:scale-90" 
                            onClick={() => onMove(item.id, 'down')}
                        >
                            <ArrowDown className="h-3 w-3" />
                        </Button>
                    </div>
                    <Separator orientation="vertical" className="h-4 mx-0 sm:mx-0.5 opacity-10" />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 sm:h-7 sm:w-7 rounded-xl text-destructive hover:bg-destructive/10 active:scale-90 transition-all" 
                                title="Delete element"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl border-destructive/20 shadow-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-black tracking-tighter text-xl">
                                    Delete Module?
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-sm font-medium">
                                    Are you sure you want to delete <span className="text-foreground font-bold">&quot;{item.title}&quot;</span>? 
                                    This will remove the module and all its sub-modules from the current structure.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-4 gap-2">
                                <AlertDialogCancel className="rounded-xl border-muted-foreground/10 font-bold uppercase text-[10px]">
                                    Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={() => onDelete(item.id)}
                                    className="rounded-xl bg-destructive hover:bg-destructive/90 font-black uppercase text-[10px] shadow-lg shadow-destructive/20"
                                >
                                    Confirm Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="ml-6 sm:ml-10 mt-1 space-y-1">
                    {item.subModules?.map((child, idx) => (
                        <RecursiveModuleItem
                            key={child.id}
                            item={child}
                            depth={depth + 1}
                            parentPath={item.base_path}
                            expandedIds={expandedIds}
                            onExpand={onExpand}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onAddChild={onAddChild}
                            onMove={onMove}
                            isFirst={idx === 0}
                            isLast={idx === (item.subModules?.length || 0) - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
