import * as React from "react";

export type SubsystemStatus = "active" | "comingSoon";

export interface NavItem {
    title: string;
    url: string;
    slug?: string;
    status?: string | SubsystemStatus;
    icon?: React.ComponentType<{ className?: string }>;
    iconName?: string | null;
    // Subscription ID that a module belongs to (nullable)
    subscription?: number | null;
    // Indicates the module is locked for the current company (leaf items only)
    isLocked?: boolean;
    items?: NavItem[];
}
