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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Settings2, Sparkles, Box, LayoutGrid, AlertTriangle } from "lucide-react";
import { SubsystemRegistration, SUBSYSTEM_CATEGORIES } from "../types";
import { cn } from "@/lib/utils";
import { IconPicker } from "./IconPicker";

interface SubsystemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Partial<SubsystemRegistration>) => Promise<boolean | undefined>;
    subsystem?: SubsystemRegistration | null;
}

export function SubsystemDialog({
    open,
    onOpenChange,
    onSubmit,
    subsystem,
}: SubsystemDialogProps) {
    const isEdit = !!subsystem;
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [formData, setFormData] = React.useState<Partial<SubsystemRegistration>>({
        slug: "",
        title: "",
        subtitle: "",
        base_path: "",
        category: "Operations",
        status: "active",
        icon_name: "Boxes",
        tag: "",
    });

    React.useEffect(() => {
        if (subsystem) {
            setFormData(subsystem);
        } else {
            setFormData({
                slug: "",
                title: "",
                subtitle: "",
                base_path: "",
                category: "Operations",
                status: "active",
                icon_name: "Boxes",
                tag: "",
            });
        }
    }, [subsystem, open]);

    const handleChange = (field: keyof SubsystemRegistration, value: string) => {
        if (field === "slug") {
            const processedSlug = value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
            setFormData((prev) => ({ 
                ...prev, 
                slug: processedSlug,
                // Only auto-update base_path if it hasn't been manually diverged or if it's a new registration
                base_path: !isEdit || prev.base_path === `/${prev.slug}` ? `/${processedSlug}` : prev.base_path
            }));
            return;
        }
        if (field === "base_path") {
            // Ensure base_path always starts with / and has no spaces
            let processedPath = value.toLowerCase().replace(/\s+/g, "-");
            if (processedPath && !processedPath.startsWith("/")) {
                processedPath = "/" + processedPath;
            }
            setFormData((prev) => ({ ...prev, base_path: processedPath }));
            return;
        }
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleAction = async () => {
        setIsSaving(true);
        try {
            const success = await onSubmit(formData);
            if (success) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error("Submission failed:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="p-0 sm:max-w-[500px] overflow-hidden rounded-2xl border shadow-2xl flex flex-col bg-background/95 backdrop-blur-sm">
                <DialogHeader className="p-6 pb-4 border-b bg-muted/20 relative">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-2xl shadow-inner ring-1 ring-primary/20">
                            <Box className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <DialogTitle className="text-xl font-black tracking-tighter text-foreground leading-none">
                                {isEdit ? "Subsystem Update" : "Subsystem Registration"}
                            </DialogTitle>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1 max-h-[70vh]">
                    <div className="p-6 space-y-6">
                        {/* Primary Identifiers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="slug" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Settings2 className="h-3 w-3" /> Slug Identifier
                                </Label>
                                <Input
                                    id="slug"
                                    value={formData.slug}
                                    onChange={(e) => handleChange("slug", e.target.value)}
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-muted/5 font-mono text-[11px] font-bold tracking-tighter placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. scm"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="tag" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Plus className="h-3 w-3" /> Acronym/Tag
                                </Label>
                                <Input
                                    id="tag"
                                    value={formData.tag}
                                    onChange={(e) => handleChange("tag", e.target.value)}
                                    className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-xs placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. SCM"
                                />
                            </div>
                        </div>

                        {/* Visual & Identity */}
                        <div className="space-y-2">
                            <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Subsystem Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card font-black text-sm tracking-tight placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                placeholder="e.g. Supply Chain Management"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="icon_name" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <LayoutGrid className="h-3 w-3" /> Visual Icon
                                </Label>
                                <IconPicker 
                                    value={formData.icon_name || "Box"} 
                                    onChange={(v) => handleChange("icon_name", v)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="base_path" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70 flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" /> Base Path
                                </Label>
                                <Input
                                    id="base_path"
                                    value={formData.base_path}
                                    onChange={(e) => handleChange("base_path", e.target.value)}
                                    className="h-10 rounded-xl border-muted-foreground/10 bg-card font-mono text-[11px] font-bold text-primary tracking-tighter placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                    placeholder="e.g. /scm"
                                />
                            </div>
                        </div>

                        {/* Path Change Warning */}
                        {isEdit && formData.base_path !== subsystem?.base_path && (
                            <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="mt-0.5 bg-orange-500/20 p-1.5 rounded-lg shadow-inner">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Warning: Path Modification</p>
                                    <p className="text-[9px] font-bold text-orange-600/80 leading-relaxed uppercase">
                                        Changing the Base Path will automatically update all sub-modules. Existing browser bookmarks will be broken.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="subtitle" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Description/Subtitle</Label>
                            <Input
                                id="subtitle"
                                value={formData.subtitle}
                                onChange={(e) => handleChange("subtitle", e.target.value)}
                                className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card text-xs font-semibold text-muted-foreground shadow-sm placeholder:text-muted-foreground/30 placeholder:italic placeholder:font-medium"
                                placeholder="Core management for logistics & inventories..."
                            />
                        </div>

                        {/* Classification grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="space-y-2">
                                <Label htmlFor="category" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Module Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) => handleChange("category", v)}
                                >
                                    <SelectTrigger className="h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 bg-card text-xs font-black">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-muted-foreground/10 shadow-2xl">
                                        {SUBSYSTEM_CATEGORIES.map((cat) => (
                                            <SelectItem key={cat} value={cat} className="text-xs font-bold rounded-lg my-0.5">{cat}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Lifecycle Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(v) => handleChange("status", v as "active" | "comingSoon")}
                                >
                                    <SelectTrigger className={cn(
                                        "h-10 rounded-xl border-muted-foreground/10 focus-visible:ring-primary/20 text-xs font-black",
                                        formData.status === 'active' ? "bg-green-500/5 text-green-600" : "bg-orange-500/5 text-orange-600"
                                    )}>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-muted-foreground/10 shadow-2xl">
                                        <SelectItem value="active" className="text-xs font-bold text-green-600 rounded-lg my-0.5">Active</SelectItem>
                                        <SelectItem value="comingSoon" className="text-xs font-bold text-orange-600 rounded-lg my-0.5">Coming Soon</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-3 shadow-[0_-8px_15px_-10px_rgba(0,0,0,0.05)]">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        className="flex-1 sm:flex-none rounded-xl px-8 font-black h-10 text-[10px] uppercase opacity-70 border border-muted-foreground/10 hover:opacity-100 transition-all hover:bg-background hover:shadow-sm"
                        disabled={isSaving}
                    >
                        CANCEL
                    </Button>
                    <Button 
                        onClick={handleAction} 
                        disabled={isSaving}
                        className="flex-1 sm:flex-none rounded-xl px-12 font-black shadow-xl shadow-primary/20 bg-primary h-10 text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            isEdit ? "UPDATE" : "REGISTER"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
