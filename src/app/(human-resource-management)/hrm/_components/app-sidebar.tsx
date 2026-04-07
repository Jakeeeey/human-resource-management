"use client";

import * as React from "react";
import { type ComponentProps } from "react";
import Link from "next/link";
import Image from "next/image";
import * as Icons from "lucide-react";
import { type LucideIcon } from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { SIDEBAR_REFRESH_EVENT } from "./sidebar-events";
import { ModuleRegistration, NavItem } from "@/modules/human-resource-management/subsystem-registration/types";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";

// Dynamic Icon Resolver
const getIcon = (name?: string): LucideIcon => {
    if (!name) return Icons.Box;
    return (Icons as unknown as Record<string, LucideIcon>)[name] || Icons.Box;
};

export function AppSidebar({
    className,
    ...props
}: ComponentProps<typeof Sidebar>) {
    // Local Permission State
    const [permissions, setPermissions] = React.useState<string[]>([]);
    const [moduleIds, setModuleIds] = React.useState<number[]>([]);
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [isPermLoading, setIsPermLoading] = React.useState(true);

    // Local Navigation State
    const [modules, setModules] = React.useState<ModuleRegistration[]>([]);
    const [isNavLoading, setIsNavLoading] = React.useState(true);

    const [searchTerm, setSearchTerm] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    
    const isLoading = isPermLoading || isNavLoading;

    // Local Fetching Logic
    const fetchPermissions = React.useCallback(async () => {
        setIsPermLoading(true);
        try {
            const res = await fetch("/api/hrm/app-sidebar/user-profile");
            if (res.ok) {
                const data = await res.json();
                setPermissions(data.permissions || []);
                setModuleIds(Array.isArray(data.moduleIds) ? data.moduleIds : []);
                setIsAdmin(!!data.isAdmin);
            }
        } catch (err) {
            console.error("[Sidebar] Permission fetch error:", err);
        } finally {
            setIsPermLoading(false);
        }
    }, []);

    const fetchModules = React.useCallback(async () => {
        setIsNavLoading(true);
        try {
            const res = await fetch("/api/hrm/app-sidebar/navigation");
            if (res.ok) {
                const { data: allModules } = await res.json();
                
                // Build recursive tree (logic replicated from useNavigationStore)
                const modulesById: Record<string, ModuleRegistration> = {};
                const roots: ModuleRegistration[] = [];

                (allModules || []).forEach((m: ModuleRegistration) => {
                    const mod: ModuleRegistration = {
                        ...m,
                        id: String(m.id),
                        subModules: []
                    };
                    modulesById[mod.id] = mod;
                });

                (allModules || []).forEach((m: ModuleRegistration) => {
                    const id = String(m.id);
                    const parentId = m.parent_module_id ? String(m.parent_module_id) : null;
                    if (parentId && modulesById[parentId]) {
                        modulesById[parentId].subModules?.push(modulesById[id]);
                    } else if (!parentId) {
                        roots.push(modulesById[id]);
                    }
                });

                setModules(roots);
            }
        } catch (err) {
            console.error("[Sidebar] Navigation fetch error:", err);
        } finally {
            setIsNavLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchPermissions();
        fetchModules();
    }, [fetchPermissions, fetchModules]);

    // Custom Event Listener for cross-module refresh
    React.useEffect(() => {
        const handleRefresh = () => {
            console.log("[Sidebar] Refresh signal received. Re-fetching...");
            fetchPermissions();
            fetchModules();
        };

        window.addEventListener(SIDEBAR_REFRESH_EVENT, handleRefresh);
        return () => window.removeEventListener(SIDEBAR_REFRESH_EVENT, handleRefresh);
    }, [fetchPermissions, fetchModules]);

    // Keyboard shortcut for search
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
            if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Recursive function to filter mapping modules to NavItems
    const filteredNavMain = React.useMemo(() => {
        if (isLoading) return [];

        function mapToNavItems(modules: ModuleRegistration[]): NavItem[] {
            return modules
                .map((m) => {
                    const moduleId = Number(m.id);
                    const isAuthorized = isAdmin || moduleIds.includes(moduleId);
                    
                    const item: NavItem = {
                        title: m.title,
                        url: m.base_path || "#",
                        slug: m.slug,
                        status: m.status,
                        icon: getIcon(m.icon_name),
                    };

                    if (m.subModules && m.subModules.length > 0) {
                        const authorizedChildren = mapToNavItems(m.subModules);
                        if (isAuthorized || authorizedChildren.length > 0) {
                            return { ...item, items: authorizedChildren };
                        }
                        return null;
                    }

                    return isAuthorized ? item : null;
                })
                .filter((item): item is NavItem => item !== null)
                .sort((a, b) => {
                    const modA = modules.find(m => m.slug === a.slug);
                    const modB = modules.find(m => m.slug === b.slug);
                    return (modA?.sort || 0) - (modB?.sort || 0);
                });
        }

        const baseNav = mapToNavItems(modules);

        if (!searchTerm) return baseNav;

        const lowerTerm = searchTerm.toLowerCase();
        function filterTree(items: NavItem[]): NavItem[] {
            return items
                .map((item) => {
                    const titleMatch = item.title.toLowerCase().includes(lowerTerm);
                    const filteredChildren = item.items ? filterTree(item.items) : undefined;
                    const hasChildMatch = !!filteredChildren?.length;

                    if (titleMatch || hasChildMatch) {
                        return { ...item, items: filteredChildren } as NavItem;
                    }
                    return null;
                })
                .filter((item): item is NavItem => item !== null);
        }

        return filterTree(baseNav);
    }, [modules, isAdmin, isLoading, searchTerm, moduleIds]);

    return (
        <Sidebar
            {...props}
            className={cn(
                "border-r border-sidebar-border/60 dark:border-white/20",
                "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
                className
            )}
        >
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/main-dashboard">
                                <div className="flex aspect-square size-10 items-center justify-center overflow-hidden">
                                    <Image
                                        src="/vertex_logo_black.png"
                                        alt="VOS Logo"
                                        width={40}
                                        height={40}
                                        className="h-9 w-10 object-contain"
                                        priority
                                    />
                                </div>

                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">VOS Web</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Human Resource Management
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <Separator />

            <SidebarContent className="flex flex-col h-full overflow-hidden">
                <div className="sticky top-0 bg-sidebar/95 backdrop-blur-sm z-20 px-4 py-3 pb-2 border-b border-sidebar-border/30">
                    <div className="relative group/search">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 group-focus-within/search:text-primary transition-colors" />
                        <Input
                            ref={inputRef}
                            placeholder="Quick search modules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={cn(
                                "pl-9 pr-12 h-9 bg-sidebar-accent/50 border-sidebar-border/50 rounded-full transition-all text-sm shadow-sm",
                                "focus-visible:bg-sidebar-accent/80 focus-visible:ring-1 focus-visible:ring-sidebar-ring focus-visible:border-sidebar-border",
                                "placeholder:text-muted-foreground/50 font-medium"
                            )}
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {searchTerm ? (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="size-4 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                >
                                    <X className="size-full" />
                                </button>
                            ) : (
                                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                    <span className="text-[12px]">/</span>
                                </kbd>
                            )}
                        </div>
                    </div>
                </div>

                <ScrollArea
                    className={cn(
                        "min-h-0 flex-1",
                        "[&_[data-radix-scroll-area-viewport]>div]:block",
                        "[&_[data-radix-scroll-area-viewport]>div]:w-full",
                        "[&_[data-radix-scroll-area-viewport]>div]:min-w-0"
                    )}
                >
                    <div className="w-full min-w-0">
                        {isLoading ? (
                            <div className="px-6 py-4 space-y-4">
                                <div className="h-4 w-3/4 bg-muted animate-pulse rounded-md" />
                                <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md opacity-50" />
                                <div className="h-4 w-2/3 bg-muted animate-pulse rounded-md opacity-30" />
                            </div>
                        ) : (
                            <NavMain items={filteredNavMain} searchTerm={searchTerm} />
                        )}
                    </div>
                </ScrollArea>
            </SidebarContent>

            <SidebarFooter className="p-0">
                <Separator />
                <div className="py-3 text-center text-[10px] font-bold tracking-tighter text-muted-foreground/40">
                    VOS WEB V2.0
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
