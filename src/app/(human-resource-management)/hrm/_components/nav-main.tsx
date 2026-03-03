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
    type LucideIcon,
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

type NavNode = {
    title: string;
    url: string;
    icon?: LucideIcon;
    items?: NavNode[];
};

function hasActiveInTree(pathname: string, node?: NavNode): boolean {
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

function L2Icon({ node, kind }: { node: NavNode; kind: "leaf" | "parent" }) {
    const Icon = node.icon ?? (kind === "parent" ? Folder : FileText);
    return <Icon className={ICON_L2_CLASS} />;
}

function L3Icon({ node }: { node: NavNode }) {
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

/* -------------------------------- component -------------------------------- */

export function NavMain({ items }: { items: NavNode[] }) {
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

        return () => {
            window.removeEventListener(THEME_SETTINGS_EVENT, onThemeSettingsChanged as EventListener);
        };
    }, []);

    const [openMap, setOpenMap] = React.useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const l1 of items) {
            if (l1.items?.length) initial[l1.title] = hasActiveInTree(pathname, l1);
            for (const l2 of l1.items ?? []) {
                if (l2.items?.length) initial[`${l1.title}::${l2.title}`] = hasActiveInTree(pathname, l2);
            }
        }
        return initial;
    });

    React.useEffect(() => {
        setOpenMap((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const l1 of items) {
                if (l1.items?.length) {
                    const should = hasActiveInTree(pathname, l1);
                    if (should && !next[l1.title]) {
                        next[l1.title] = true;
                        changed = true;
                    }
                }
                for (const l2 of l1.items ?? []) {
                    if (l2.items?.length) {
                        const key = `${l1.title}::${l2.title}`;
                        const should = hasActiveInTree(pathname, l2);
                        if (should && !next[key]) {
                            next[key] = true;
                            changed = true;
                        }
                    }
                }
            }

            return changed ? next : prev;
        });
    }, [pathname, items]);

    return (
        <SidebarGroup
            className="overflow-x-hidden"
            style={
                {
                    "--vos-pill": accentVars.pill,
                    "--vos-pill-foreground": accentVars.fg,
                } as React.CSSProperties
            }
        >
            <SidebarMenu className="overflow-x-hidden">
                {items.map((l1) => {
                    const l1HasChildren = !!l1.items?.length;
                    const l1Exact = isRouteActiveExact(pathname, l1.url);
                    const l1Open = l1HasChildren ? !!openMap[l1.title] : false;
                    const l1Clickable = l1.url !== "#";

                    return (
                        <Collapsible
                            key={l1.title}
                            asChild
                            open={l1HasChildren ? l1Open : undefined}
                            onOpenChange={l1HasChildren ? (v) => setOpenMap((p) => ({ ...p, [l1.title]: v })) : undefined}
                        >
                            <SidebarMenuItem className="min-w-0 overflow-hidden">
                                {/* LEVEL 1 */}
                                {l1HasChildren ? (
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton
                                            tooltip={l1.title}
                                            className={cn("cursor-pointer min-w-0 overflow-hidden", OUTER_ROW_NO_GREY)}
                                            data-active={l1Exact}
                                        >
                                            <div className={ROW}>
                                                <div className={cn(PILL_BASE, GAP_L1, PILL_HOVER, PILL_ACTIVE)}>
                                                    {l1.icon ? <l1.icon className={ICON_L1_CLASS} /> : null}
                                                    <span className={LABEL}>{l1.title}</span>

                                                    {l1Open ? (
                                                        <ChevronDown className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                                                    ) : (
                                                        <ChevronRight className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                                                    )}
                                                </div>
                                            </div>
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                ) : (
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={l1.title}
                                        className={cn("cursor-pointer min-w-0 overflow-hidden", OUTER_ROW_NO_GREY)}
                                        data-active={l1Exact}
                                    >
                                        {l1Clickable ? (
                                            <Link href={l1.url} className={ROW}>
                                                <div className={cn(PILL_BASE, GAP_L1, PILL_HOVER, PILL_ACTIVE)}>
                                                    {l1.icon ? <l1.icon className={ICON_L1_CLASS} /> : null}
                                                    <span className={LABEL}>{l1.title}</span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className={ROW}>
                                                <div className={cn(PILL_BASE, GAP_L1, PILL_HOVER, PILL_ACTIVE)}>
                                                    {l1.icon ? <l1.icon className={ICON_L1_CLASS} /> : null}
                                                    <span className={LABEL}>{l1.title}</span>
                                                </div>
                                            </div>
                                        )}
                                    </SidebarMenuButton>
                                )}

                                {/* ✅ L1 dropdown animation wrapper (fixed) */}
                                {l1HasChildren ? (
                                    <div className={cn(DROP_WRAP, l1Open ? DROP_OPEN : DROP_CLOSED)}>
                                        <div className={DROP_INNER}>
                                            <CollapsibleContent forceMount>
                                                <div>
                                                    <SidebarMenuSub className={SUB_WRAP_L2}>
                                                        {l1.items!.map((l2) => {
                                                            const l2HasChildren = !!l2.items?.length;
                                                            const l2Key = `${l1.title}::${l2.title}`;
                                                            const l2Open = l2HasChildren ? !!openMap[l2Key] : false;

                                                            const l2Exact = isRouteActiveExact(pathname, l2.url);
                                                            const l2Clickable = l2.url !== "#";

                                                            if (!l2HasChildren) {
                                                                return (
                                                                    <SidebarMenuSubItem key={l2.title} className="min-w-0 overflow-hidden">
                                                                        <SidebarMenuSubButton
                                                                            asChild
                                                                            isActive={l2Exact}
                                                                            data-active={l2Exact}
                                                                            className={cn("cursor-pointer", subBtnVariants({ level: 2 }), OUTER_ROW_NO_GREY)}
                                                                        >
                                                                            {l2Clickable ? (
                                                                                <Link href={l2.url} className={ROW}>
                                                                                    <div className={cn(PILL_BASE, GAP_L2, PILL_HOVER, PILL_ACTIVE)}>
                                                                                        <L2Icon node={l2} kind="leaf" />
                                                                                        <span className={LABEL}>{l2.title}</span>
                                                                                    </div>
                                                                                </Link>
                                                                            ) : (
                                                                                <div className={ROW}>
                                                                                    <div className={cn(PILL_BASE, GAP_L2, PILL_HOVER, PILL_ACTIVE)}>
                                                                                        <L2Icon node={l2} kind="leaf" />
                                                                                        <span className={LABEL}>{l2.title}</span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </SidebarMenuSubButton>
                                                                    </SidebarMenuSubItem>
                                                                );
                                                            }

                                                            return (
                                                                <Collapsible
                                                                    key={l2.title}
                                                                    asChild
                                                                    open={l2Open}
                                                                    onOpenChange={(v) => setOpenMap((p) => ({ ...p, [l2Key]: v }))}
                                                                >
                                                                    <SidebarMenuSubItem className="min-w-0 overflow-hidden">
                                                                        <CollapsibleTrigger asChild>
                                                                            <SidebarMenuSubButton
                                                                                isActive={l2Exact}
                                                                                data-active={l2Exact}
                                                                                className={cn("cursor-pointer", subBtnVariants({ level: 2 }), OUTER_ROW_NO_GREY)}
                                                                            >
                                                                                <div className={ROW}>
                                                                                    <div className={cn(PILL_BASE, GAP_L2, PILL_HOVER, PILL_ACTIVE)}>
                                                                                        <L2Icon node={l2} kind="parent" />
                                                                                        <span className={LABEL}>{l2.title}</span>

                                                                                        {l2Open ? (
                                                                                            <ChevronDown className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                                                                                        ) : (
                                                                                            <ChevronRight className={cn("ml-auto size-4 shrink-0", CHEVRON_ANIM)} />
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </SidebarMenuSubButton>
                                                                        </CollapsibleTrigger>

                                                                        {/* ✅ L2 dropdown animation wrapper (fixed) */}
                                                                        <div className={cn(DROP_WRAP, l2Open ? DROP_OPEN : DROP_CLOSED)}>
                                                                            <div className={DROP_INNER}>
                                                                                <CollapsibleContent forceMount>
                                                                                    <div>
                                                                                        <SidebarMenuSub className={SUB_WRAP_L3}>
                                                                                            {l2.items!.map((l3) => {
                                                                                                const l3Exact = isRouteActiveExact(pathname, l3.url);
                                                                                                const l3Clickable = l3.url !== "#";

                                                                                                return (
                                                                                                    <SidebarMenuSubItem key={l3.title} className="min-w-0 overflow-hidden">
                                                                                                        <SidebarMenuSubButton
                                                                                                            asChild
                                                                                                            isActive={l3Exact}
                                                                                                            data-active={l3Exact}
                                                                                                            className={cn("cursor-pointer", subBtnVariants({ level: 3 }), OUTER_ROW_NO_GREY)}
                                                                                                        >
                                                                                                            {l3Clickable ? (
                                                                                                                <Link href={l3.url} className={ROW}>
                                                                                                                    <div className={cn(PILL_BASE, GAP_L3, PILL_HOVER, PILL_ACTIVE)}>
                                                                                                                        <L3Icon node={l3} />
                                                                                                                        <span className={LABEL}>{l3.title}</span>
                                                                                                                    </div>
                                                                                                                </Link>
                                                                                                            ) : (
                                                                                                                <div className={ROW}>
                                                                                                                    <div className={cn(PILL_BASE, GAP_L3, PILL_HOVER, PILL_ACTIVE)}>
                                                                                                                        <L3Icon node={l3} />
                                                                                                                        <span className={LABEL}>{l3.title}</span>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </SidebarMenuSubButton>
                                                                                                    </SidebarMenuSubItem>
                                                                                                );
                                                                                            })}
                                                                                        </SidebarMenuSub>
                                                                                    </div>
                                                                                </CollapsibleContent>
                                                                            </div>
                                                                        </div>
                                                                    </SidebarMenuSubItem>
                                                                </Collapsible>
                                                            );
                                                        })}
                                                    </SidebarMenuSub>
                                                </div>
                                            </CollapsibleContent>
                                        </div>
                                    </div>
                                ) : null}
                            </SidebarMenuItem>
                        </Collapsible>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
