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
import { Checkbox } from "@/components/ui/checkbox";
import { 
    Shield, 
    Lock 
} from "lucide-react";
import { 
    SubsystemRegistration,
    ModuleRegistration,
    SubModuleRegistration
} from "@/modules/human-resource-management/subsystem-registration/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PermissionsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: { full_name: string; user_id: string } | null;
    subsystem: SubsystemRegistration | null;
    authorizedItems: string[]; // Current list of authorized slugs
    onUpdate: (userId: string, authorizedItems: string[]) => void;
}

export function PermissionsDialog({
    open,
    onOpenChange,
    user,
    subsystem,
    authorizedItems,
    onUpdate,
}: PermissionsDialogProps) {
    const [localAuthorized, setLocalAuthorized] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (open) {
            setLocalAuthorized(authorizedItems);
        }
    }, [open, authorizedItems]);

    if (!user || !subsystem) return null;

    const toggleItem = (slug: string, checked: boolean) => {
        if (checked) {
            setLocalAuthorized([...localAuthorized, slug]);
        } else {
            // If we uncheck a parent, should we uncheck children?
            // For now, just a flat toggle, but we can add cascading logic later.
            setLocalAuthorized(localAuthorized.filter(s => s !== slug));
        }
    };

    const handleSave = () => {
        onUpdate(user.user_id, localAuthorized);
        onOpenChange(false);
    };

    const isSubsystemChecked = localAuthorized.includes(subsystem.slug);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] h-[70vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Permissions: {user.full_name}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Configure access for <span className="font-bold text-foreground">{subsystem.title}</span>
                    </p>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                            <Checkbox 
                                id="subsystem-access" 
                                checked={isSubsystemChecked}
                                onCheckedChange={(checked) => toggleItem(subsystem.slug, !!checked)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="subsystem-access"
                                    className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    Enable Subsystem Access
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Main entry point for this system.
                                </p>
                            </div>
                        </div>

                        {!isSubsystemChecked && (
                            <div className="text-center py-6 bg-muted/10 rounded-lg border border-dashed">
                                <Lock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Enable subsystem access to configure modules.</p>
                            </div>
                        )}

                        {isSubsystemChecked && (
                            <div className="space-y-4 pl-1">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Modules & Sub-modules</h4>
                                {subsystem.modules?.map((module) => (
                                    <ModulePermissionItem
                                        key={module.id}
                                        module={module}
                                        authorizedItems={localAuthorized}
                                        onToggle={(slug, checked) => toggleItem(slug, checked)}
                                    />
                                ))}
                                {(!subsystem.modules || subsystem.modules.length === 0) && (
                                    <p className="text-xs italic text-muted-foreground">No modules defined for this subsystem.</p>
                                )}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-2 border-t">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Apply Permissions</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModulePermissionItem({ 
    module, 
    authorizedItems, 
    onToggle 
}: { 
    module: ModuleRegistration; 
    authorizedItems: string[]; 
    onToggle: (slug: string, checked: boolean) => void 
}) {
    const isChecked = authorizedItems.includes(module.slug);
    const hasChildren = module.subModules && module.subModules.length > 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center space-x-3">
                <Checkbox 
                    id={`module-${module.id}`} 
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(module.slug, !!checked)}
                />
                <label
                    htmlFor={`module-${module.id}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                >
                    {module.title}
                </label>
            </div>

            {isChecked && hasChildren && (
                <div className="pl-7 space-y-2 border-l-2 ml-1.5 py-1">
                    {module.subModules.map((sub: SubModuleRegistration) => (
                        <div key={sub.id} className="flex items-center space-x-3">
                            <Checkbox 
                                id={`sub-${sub.id}`} 
                                checked={authorizedItems.includes(sub.slug)}
                                onCheckedChange={(checked) => onToggle(sub.slug, !!checked)}
                            />
                            <label
                                htmlFor={`sub-${sub.id}`}
                                className="text-xs leading-none cursor-pointer"
                            >
                                {sub.title}
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
