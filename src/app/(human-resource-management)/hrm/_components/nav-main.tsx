"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cva } from "class-variance-authority";
import {
    ChevronRight,
    ChevronDown,
    FileText,
    Folder,
    SearchX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { NavItem } from "@/modules/human-resource-management/subsystem-registration/types";

import { THEME_SETTINGS_EVENT } from "@/components/theme/theme-settings";

/* --------------------------------- helpers -------------------------------- */

function normalizePath(p: string) {
    if (!p) return "/";
    if (p !== "/" && p.endsWith("/")) return p.slice(0, -1);
    return p;
}

function isRouteActiveExact(currentPath: string, targetUrl: string) {
    if (!targetUrl || targetUrl === "#") return false;
    const cur = normalizePath(currentPath);
    const tgt = normalizePath(targetUrl);
    return cur === tgt;
}

function hasActiveInTree(pathname: string, node?: NavItem): boolean {
    if (!node) return false;
    if (isRouteActiveExact(pathname, node.url)) return true;
    return node.items?.some((c) => hasActiveInTree(pathname, c)) ?? false;
}

/* ------------------------- accent from localStorage ------------------------- */

type VOSThemeSettingsV1 = {
    accent?: string;
    radiusRem?: number;
    density?: "compact" | "comfortable";
};

const ACCENT_HSL: Record<string, { pill: string; fg: string }> = {
    amber: { pill: "45 93% 47%", fg: "0 0% 10%" },
    blue: { pill: "217 91% 60%", fg: "0 0% 100%" },
    emerald: { pill: "142 71% 45%", fg: "0 0% 100%" },
    violet: { pill: "262 83% 58%", fg: "0 0% 100%" },
    rose: { pill: "346 77% 50%", fg: "0 0% 100%" },
    slate: { pill: "215 16% 47%", fg: "0 0% 100%" },
};

function readVOSThemeSettings(): VOSThemeSettingsV1 | null {
    try {
        const raw = localStorage.getItem("vos_theme_settings_v1");
        if (!raw) return null;
        return JSON.parse(raw) as VOSThemeSettingsV1;
    } catch {
        return null;
    }
}

function resolveAccentVars(accent?: string) {
    const key = String(accent ?? "").trim().toLowerCase();
    return ACCENT_HSL[key] ?? ACCENT_HSL.amber;
}

/* ---------------------------------- layout --------------------------------- */

const SUB_WRAP_RESET = "mx-0 px-0 translate-x-0 border-l-0 w-full min-w-0 overflow-hidden";

const SUB_WRAP_L2 = cn(
    SUB_WRAP_RESET,
    "relative py-0.5",
    "before:content-[''] before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-sidebar-border/70"
);

const SUB_WRAP_L3 = cn(
    SUB_WRAP_RESET,
    "relative py-0.5",
    "before:content-[''] before:absolute before:left-9 before:top-0 before:bottom-0 before:w-px before:bg-sidebar-border/70"
);

const ROW = "flex w-full min-w-0 flex-nowrap items-center overflow-hidden";
const LABEL = "min-w-0 w-0 flex-1 truncate";

/* ----------------------------- pill (hover + active) ------------------------ */

const PILL_BASE =
    "flex min-w-0 flex-1 items-center " +
    "rounded-[var(--radius)] px-3 py-1.5 " +
    "bg-transparent text-inherit shadow-none " +
    "transition-[background-color,color,box-shadow] duration-150";

const GAP_L1 = "gap-2";
const GAP_L2 = "gap-2";
const GAP_L3 = "gap-2";

const PILL_HOVER =
    "hover:bg-[hsl(var(--vos-pill))] hover:text-[hsl(var(--vos-pill-foreground))] hover:shadow-sm " +
    "dark:hover:!text-black";

const PILL_ACTIVE =
    "group-data-[active=true]:bg-[hsl(var(--vos-pill))] " +
    "group-data-[active=true]:text-[hsl(var(--vos-pill-foreground))] " +
    "group-data-[active=true]:shadow-sm " +
    "dark:group-data-[active=true]:!text-black";

const OUTER_ROW_NO_GREY =
    "group !bg-transparent !shadow-none " +
    "!hover:bg-transparent !active:bg-transparent " +
    "data-[active=true]:!bg-transparent " +
    "focus-visible:!ring-0";

/* ---------------------------------- CVA ----------------------------------- */

const subBtnVariants = cva(
    cn("relative w-full min-w-0 overflow-hidden justify-start !translate-x-0 rounded-md"),
    {
        variants: {
            level: {
                2: "h-8 text-sm pl-7 pr-2",
                3: "h-8 text-sm pl-12 pr-2",
            },
        },
        defaultVariants: { level: 2 },
    }
);

/* ---------------------------------- icons --------------------------------- */

const ICON_L1_CLASS = "size-5 shrink-0 text-current";
const ICON_L2_CLASS = "size-4 shrink-0 text-current";
const ICON_L3_CLASS = "size-4 shrink-0 text-current";

function L2Icon({ node, kind }: { node: NavItem; kind: "leaf" | "parent" }) {
    const Icon = node.icon ?? (kind === "parent" ? Folder : FileText);
    return <Icon className={ICON_L2_CLASS} />;
}

function L3Icon({ node }: { node: NavItem }) {
    const Icon = node.icon ?? FileText;
    return <Icon className={ICON_L3_CLASS} />;
}

/* ------------------------ dropdown animation (fixed) ------------------------ */
/**
 * ✅ Key fix:
 * - Keep CollapsibleContent mounted (forceMount)
 * - Animate a wrapper that always exists
 * - Disable pointer events while closed
 */
const DROP_WRAP =
    "grid transition-[grid-template-rows,opacity] duration-200 ease-out will-change-[grid-template-rows,opacity]";
const DROP_OPEN = "grid-rows-[1fr] opacity-100 pointer-events-auto";
const DROP_CLOSED = "grid-rows-[0fr] opacity-0 pointer-events-none";
const DROP_INNER = "min-h-0 overflow-hidden";

const CHEVRON_ANIM = "transition-transform duration-200 ease-out";

/* --------------------------------- soon badge -------------------------------- */
function SoonBadge() {
    return (
        <span className="ml-auto flex h-4 items-center rounded-full bg-amber-500/10 px-1.5 text-[8px] font-black uppercase tracking-tighter text-amber-600 border border-amber-500/20 shadow-sm">
            Soon
        </span>
    );
}

function HighlightMatch({ text, term }: { text: string; term?: string }) {
    if (!term || !term.trim()) return <>{text}</>;

    const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${safeTerm})`, "gi"));

    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === term.toLowerCase() ? (
                    <span
                        key={i}
                        className="text-amber-600 font-bold underline decoration-2 underline-offset-[3px] decoration-amber-500/40"
                    >
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
}

/* -------------------------------- component -------------------------------- */

/* ---------------------------- Recursive Nav Item --------------------------- */

interface RecursiveNavItemProps {
    node: NavItem;
    depth: number;
    pathname: string;
    searchTerm?: string;
    openMap: Record<string, boolean>;
    toggleOpen: (key: string) => void;
    parentKey?: string;
    isLast: boolean;
}

function RecursiveNavItem({
    node,
    depth,
    pathname,
    searchTerm,
    openMap,
    toggleOpen,
    parentKey,
    isLast,
}: RecursiveNavItemProps) {
    const hasChildren = !!node.items?.length;
    const currentKey = parentKey ? `${parentKey}::${node.title}` : node.title;
    const isOpen = hasChildren ? !!openMap[currentKey] : false;
    const isActive = isRouteActiveExact(pathname, node.url);
    const isClickable = node.url !== "#";
    const isComingSoon = node.status === "comingSoon";

    // Indentation: 0 -> 12px, 1 -> 32px, 2 -> 52px...
    const indent = 12 + (depth * 20);
    
    // Parent Icon Center X (where our vertical line should be)
    // L1 icon center = 22px
    // L[d] icon center = (12 + d*20) + 8
    const parentIconCenterX = depth === 0 ? 0 : depth === 1 ? 22 : (12 + (depth - 1) * 20) + 8;

    const Icon = node.icon ?? (depth === 0 ? undefined : hasChildren ? Folder : FileText);
    const iconClass = depth === 0 ? ICON_L1_CLASS : ICON_L2_CLASS;
    const gapClass = depth === 0 ? GAP_L1 : GAP_L2;

    const content = (
        <div className={cn(PILL_BASE, gapClass, PILL_HOVER, PILL_ACTIVE)}>
            {Icon && <Icon className={iconClass} />}
            <span className={LABEL}>
                <HighlightMatch text={node.title} term={searchTerm} />
            </span>
            {isComingSoon && <SoonBadge />}
            {hasChildren && (
                isOpen ? (
                    <ChevronDown className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                ) : (
                    <ChevronRight className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                )
            )}
        </div>
    );

    const buttonProps = {
        tooltip: node.title,
        className: cn(
            "cursor-pointer min-w-0 overflow-hidden relative group/btn",
            OUTER_ROW_NO_GREY,
            isComingSoon && "opacity-60 cursor-not-allowed",
            depth > 0 && "h-8 text-sm"
        ),
        ["data-active" as string]: isActive,
        style: { paddingLeft: `${indent}px` },
    };

    const itemContent = (
        <SidebarMenuItem className="min-w-0 overflow-hidden relative">
            {/* Tree Connectors */}
            {depth > 0 && (
                <>
                    {/* Vertical line from parent (only if we have a parentIconCenterX) */}
                    <div 
                        className={cn(
                            "absolute top-0 w-px bg-sidebar-border/50 transition-colors group-hover/btn:bg-sidebar-border",
                            isLast ? "h-4" : "h-full"
                        )}
                        style={{ left: `${parentIconCenterX}px` }}
                    />
                    {/* Horizontal tick to current item */}
                    <div 
                        className="absolute h-px bg-sidebar-border/50 top-4 transition-colors group-hover/btn:bg-sidebar-border"
                        style={{ 
                            left: `${parentIconCenterX}px`,
                            width: `${indent - parentIconCenterX}px`
                        }}
                    />
                </>
            )}

            {hasChildren ? (
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton {...buttonProps}>
                        <div className={ROW}>{content}</div>
                    </SidebarMenuButton>
                </CollapsibleTrigger>
            ) : (
                <SidebarMenuButton asChild {...buttonProps}>
                    {isClickable && !isComingSoon ? (
                        <Link href={node.url} className={ROW}>{content}</Link>
                    ) : (
                        <div className={ROW}>{content}</div>
                    )}
                </SidebarMenuButton>
            )}

            {hasChildren && (
                <div className={cn(DROP_WRAP, isOpen ? DROP_OPEN : DROP_CLOSED)}>
                    <div className={DROP_INNER}>
                        <CollapsibleContent forceMount>
                            <SidebarMenuSub className="mx-0 px-0 translate-x-0 border-0 flex flex-col gap-0 relative">
                                {node.items!.map((child, idx) => (
                                    <RecursiveNavItem
                                        key={`${currentKey}::${child.title}`}
                                        node={child}
                                        depth={depth + 1}
                                        pathname={pathname}
                                        searchTerm={searchTerm}
                                        openMap={openMap}
                                        toggleOpen={toggleOpen}
                                        parentKey={currentKey}
                                        isLast={idx === node.items!.length - 1}
                                    />
                                ))}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </div>
                </div>
            )}
        </SidebarMenuItem>
    );

    if (hasChildren) {
        return (
            <Collapsible
                open={isOpen}
                onOpenChange={() => toggleOpen(currentKey)}
                asChild
            >
                {itemContent}
            </Collapsible>
        );
    }

    return itemContent;
}


export function NavMain({ items, searchTerm }: { items: NavItem[]; searchTerm?: string }) {
    const pathname = normalizePath(usePathname() || "/");
    const [accentVars, setAccentVars] = React.useState(() => resolveAccentVars("amber"));

    React.useEffect(() => {
        const applyFromStorage = () => {
            const s = readVOSThemeSettings();
            setAccentVars(resolveAccentVars(s?.accent));
        };
        applyFromStorage();
        const onThemeSettingsChanged = () => applyFromStorage();
        window.addEventListener(THEME_SETTINGS_EVENT, onThemeSettingsChanged as EventListener);
        return () => window.removeEventListener(THEME_SETTINGS_EVENT, onThemeSettingsChanged as EventListener);
    }, []);

    const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});

    const toggleOpen = (key: string) => {
        setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Auto-expand logic (Recursive)
    React.useEffect(() => {
        const nextMap: Record<string, boolean> = {};
        
        function processNode(node: NavItem, parentKey?: string) {
            const currentKey = parentKey ? `${parentKey}::${node.title}` : node.title;
            const hasChildren = !!node.items?.length;
            
            if (hasChildren) {
                const isActiveInPath = hasActiveInTree(pathname, node);
                const isSearchMatch = searchTerm && (
                    node.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    node.items?.some(c => hasActiveInTree("", c))
                );
                
                if (searchTerm || isActiveInPath) {
                    nextMap[currentKey] = true;
                }
                
                node.items?.forEach(child => processNode(child, currentKey));
            }
        }

        items.forEach(item => processNode(item));
        setOpenMap(prev => {
            // Merge but only add true values from nextMap, don't overwrite manual closes if they didn't change
            const merged = { ...prev };
            Object.keys(nextMap).forEach(k => {
                if (nextMap[k]) merged[k] = true;
            });
            return merged;
        });
    }, [pathname, items, searchTerm]);

    return (
        <SidebarGroup
            className="overflow-x-hidden p-0"
            style={
                {
                    "--vos-pill": accentVars.pill,
                    "--vos-pill-foreground": accentVars.fg,
                } as React.CSSProperties
            }
        >
            <SidebarMenu className="overflow-x-hidden gap-0">
                {items.length === 0 && searchTerm ? (
                    <div className="px-5 py-8 text-center animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="mx-auto size-12 rounded-2xl bg-sidebar-accent/30 flex items-center justify-center mb-3 border border-sidebar-border/50">
                            <SearchX className="size-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground tracking-tight">No modules found</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">Try another keyword</p>
                    </div>
                ) : (
                    items.map((item, idx) => (
                        <RecursiveNavItem
                            key={item.title}
                            node={item}
                            depth={0}
                            pathname={pathname}
                            searchTerm={searchTerm}
                            openMap={openMap}
                            toggleOpen={toggleOpen}
                            isLast={idx === items.length - 1}
                        />
                    ))
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}


