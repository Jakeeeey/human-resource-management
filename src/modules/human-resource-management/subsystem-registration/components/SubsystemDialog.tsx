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
import { SubsystemRegistration, SUBSYSTEM_CATEGORIES } from "../types";

interface SubsystemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: Partial<SubsystemRegistration>) => void;
    subsystem?: SubsystemRegistration | null;
}

export function SubsystemDialog({
    open,
    onOpenChange,
    onSubmit,
    subsystem,
}: SubsystemDialogProps) {
    const isEdit = !!subsystem;
    
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
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Subsystem" : "Register Subsystem"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="slug" className="text-right">Slug</Label>
                        <Input
                            id="slug"
                            value={formData.slug}
                            onChange={(e) => handleChange("slug", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. scm"
                            disabled={isEdit}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">Title</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => handleChange("title", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Supply Chain Management"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="base_path" className="text-right">Base Path</Label>
                        <Input
                            id="base_path"
                            value={formData.base_path}
                            onChange={(e) => handleChange("base_path", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. /scm"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="subtitle" className="text-right">Subtitle</Label>
                        <Input
                            id="subtitle"
                            value={formData.subtitle}
                            onChange={(e) => handleChange("subtitle", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Procurement, inventory..."
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="icon_name" className="text-right">Icon Name</Label>
                        <Select
                            value={formData.icon_name}
                            onValueChange={(v) => handleChange("icon_name", v)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select icon" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Boxes">Boxes</SelectItem>
                                <SelectItem value="Users">Users</SelectItem>
                                <SelectItem value="Landmark">Landmark</SelectItem>
                                <SelectItem value="Settings">Settings</SelectItem>
                                <SelectItem value="ShieldCheck">ShieldCheck</SelectItem>
                                <SelectItem value="Factory">Factory</SelectItem>
                                <SelectItem value="FolderKanban">FolderKanban</SelectItem>
                                <SelectItem value="MessagesSquare">MessagesSquare</SelectItem>
                                <SelectItem value="Activity">Activity</SelectItem>
                                <SelectItem value="BarChart3">BarChart3</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tag" className="text-right">Tag</Label>
                        <Input
                            id="tag"
                            value={formData.tag}
                            onChange={(e) => handleChange("tag", e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. SCM"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category</Label>
                        <Select
                            value={formData.category}
                            onValueChange={(v) => handleChange("category", v)}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {SUBSYSTEM_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(v) => handleChange("status", v as "active" | "comingSoon")}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="comingSoon">Coming Soon</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => {
                        onSubmit(formData);
                        onOpenChange(false);
                    }}>
                        {isEdit ? "Save Changes" : "Register"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
