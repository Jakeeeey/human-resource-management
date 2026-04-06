// src/app/main-dashboard/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
    Search,
    ArrowUpRight,
    Sparkles,
    Timer,
    CheckCircle2,
    Boxes,
    Users,
    Landmark,
    Settings,
    ShieldCheck,
    Factory,
    FolderKanban,
    MessagesSquare,
    Activity,
    BarChart3, // ✅ added for BIA
    Sun,
    Moon,
    Monitor,
    ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Status = "active" | "comingSoon";

type SubsystemCategory =
    | "Operations"
    | "Customer & Engagement"
    | "Corporate Services"
    | "Governance & Assurance"
    | "Monitoring & Oversight";

type SubmoduleItem = {
    id: string;
    title: string;
    status?: Status;
};

type SubsystemItem = {
    id: string;
    title: string;
    subtitle?: string;
    href?: string;
    status: Status;
    category: SubsystemCategory;
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    tag?: string;
    submodules: SubmoduleItem[];
};

const CATEGORY_ORDER: SubsystemCategory[] = [
    "Operations",
    "Customer & Engagement",
    "Corporate Services",
    "Governance & Assurance",
    "Monitoring & Oversight",
];

const CATEGORY_META: Record<SubsystemCategory, { title: string; description: string }> =
    {
        Operations: {
            title: "Operations",
            description: "Core execution systems (supply, production, delivery, projects).",
        },
        "Customer & Engagement": {
            title: "Customer & Engagement",
            description: "Customer lifecycle, communications, and engagement touchpoints.",
        },
        "Corporate Services": {
            title: "Corporate Services",
            description: "Back-office functions supporting the organization (Finance, HR).",
        },
        "Governance & Assurance": {
            title: "Governance & Assurance",
            description: "Risk, audit, and compliance governance workflows.",
        },
        "Monitoring & Oversight": {
            title: "Monitoring & Oversight",
            description: "Cross-cutting monitoring, KPIs, and program oversight.",
        },
    };

const OLD_VOS_URL = process.env.NEXT_PUBLIC_OLD_VOS_URL || "/";

/**
 * Fixed header offset.
 * If you adjust header layout, tweak these values.
 */
const HEADER_OFFSET_EXPANDED = 188; // px
const HEADER_OFFSET_COMPACT = 120; // px

function DashboardFooter() {
    return (
        <footer className="fixed inset-x-0 bottom-0 z-50">
            <div className="border-t bg-background/70 backdrop-blur">
                <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-8">
                    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                            <span className="text-sm font-semibold">VOS ERP</span>
                            <Badge variant="secondary" className="h-6 px-2 text-[12px]">
                                Internal
                            </Badge>
                            <span className="hidden sm:inline text-xs text-muted-foreground">
                © {new Date().getFullYear()} Vertex Open Systems
              </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                <Link href="/docs">Docs</Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                <Link href="/support">Support</Link>
                            </Button>
                            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                                <Link href="/status">Status</Link>
                            </Button>

                            <Separator orientation="vertical" className="hidden h-5 sm:block" />

                            <span className="text-xs text-muted-foreground">
                Build: <span className="font-medium text-foreground">V2</span>
              </span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

function normalize(s: string) {
    return (s || "").toLowerCase().trim();
}

function filterSubsystems(items: SubsystemItem[], q: string): SubsystemItem[] {
    const query = normalize(q);
    if (!query) return items;

    return items.filter((x) => {
        const subHay = x.submodules.map((m) => `${m.title} ${m.status ?? ""}`).join(" ");
        const hay = [x.title, x.subtitle ?? "", x.tag ?? "", x.category, x.status, x.href ?? "", subHay].join(" ");
        return normalize(hay).includes(query);
    });
}

function groupByCategory(items: SubsystemItem[]) {
    const map = new Map<SubsystemCategory, SubsystemItem[]>();
    items.forEach((s) => {
        const list = map.get(s.category) ?? [];
        list.push(s);
        map.set(s.category, list);
    });

    return CATEGORY_ORDER.map((cat) => ({
        category: cat,
        items: (map.get(cat) ?? []).sort((a, b) => a.title.localeCompare(b.title)),
    })).filter((g) => g.items.length > 0);
}

function StatusBadge({ status }: { status: Status }) {
    if (status === "active") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Active
      </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-500/15 dark:text-zinc-200">
      <Timer className="h-3.5 w-3.5" />
      Coming Soon
    </span>
    );
}

function HoverLift({
                       children,
                       disabled,
                       className,
                   }: {
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "transition-all duration-200 ease-out",
                !disabled &&
                "hover:-translate-y-[3px] hover:shadow-[0_18px_60px_-30px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.99]",
                disabled && "opacity-95",
                className
            )}
        >
            {children}
        </div>
    );
}

function ModeToggle() {
    const { setTheme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                    <Sun className="mr-2 h-4 w-4" />
                    Theme
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function decodeJwt(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        let s = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        const json = Buffer.from(s, "base64").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function getCookie(name: string) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return null;
}

import { SubsystemService } from "@/modules/human-resource-management/subsystem-registration/services/SubsystemService";
import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";
import { usePermissionsStore } from "@/stores/usePermissionsStore";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    Boxes,
    Users,
    Landmark,
    Settings,
    ShieldCheck,
    Factory,
    FolderKanban,
    MessagesSquare,
    Activity,
    BarChart3,
};

export default function ERPMainDashboard() {
    const [q, setQ] = React.useState("");
    const [isCompactHeader, setIsCompactHeader] = React.useState(false);
    const [registeredSubsystems, setRegisteredSubsystems] = React.useState<SubsystemRegistration[]>([]);

    const { permissions: authorizedSubsystems, isLoading: loadingPermissions, fetchPermissions } = usePermissionsStore();

    React.useEffect(() => {
        const onScroll = () => setIsCompactHeader(window.scrollY > 36);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    React.useEffect(() => {
        const load = async () => {
            fetchPermissions();
            // Load registry
            const registry = await SubsystemService.getSubsystems();
            setRegisteredSubsystems(registry);
        };
        load();
    }, [fetchPermissions]);

    const subsystems = React.useMemo(() => {
        return registeredSubsystems.map((s): SubsystemItem => ({
            id: s.slug,
            title: s.title,
            subtitle: s.subtitle,
            href: s.base_path,
            status: s.status,
            category: s.category as SubsystemCategory,
            icon: ICON_MAP[s.icon_name] || Activity,
            tag: s.tag,
            accentClass: "bg-primary/10 text-primary dark:text-primary-foreground ring-1 ring-primary/20", // Default accent
            submodules: [], // Could also be made dynamic later
        }));
    }, [registeredSubsystems]);



    const allowedIds = React.useMemo(() => {
        // Only show subsystems explicitly authorized in the database
        return new Set(authorizedSubsystems || []);
    }, [authorizedSubsystems]);

    const positionFiltered = React.useMemo(() => subsystems.filter((s) => allowedIds.has(s.id)), [allowedIds, subsystems]);

    const filtered = React.useMemo(() => filterSubsystems(positionFiltered, q), [positionFiltered, q]);
    const grouped = React.useMemo(() => groupByCategory(filtered), [filtered]);

    const totalActiveVisible = React.useMemo(
        () => positionFiltered.filter((s) => s.status === "active").length,
        [positionFiltered]
    );

    const headerOffset = isCompactHeader ? HEADER_OFFSET_COMPACT : HEADER_OFFSET_EXPANDED;

    return (
        <div className="relative min-h-screen flex flex-col overflow-x-hidden">
            {/* Background */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-black" />
            <div className="absolute inset-0 -z-10 opacity-[0.70] dark:opacity-[0.55] bg-[radial-gradient(circle_at_15%_10%,rgba(99,102,241,0.18),transparent_45%),radial-gradient(circle_at_85%_15%,rgba(16,185,129,0.14),transparent_45%),radial-gradient(circle_at_30%_90%,rgba(244,63,94,0.10),transparent_50%),radial-gradient(circle_at_80%_85%,rgba(168,85,247,0.14),transparent_50%)]" />
            <div className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.10] [background-image:radial-gradient(#000_1px,transparent_1px)] [background-size:18px_18px]" />

            {/* FIXED HEADER */}
            <header className="fixed inset-x-0 top-0 z-50 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-8">
                    <div className={cn("transition-all duration-200", isCompactHeader ? "py-3" : "py-5")}>
                        <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="secondary" size="sm" className="rounded-full">
                                <a href={OLD_VOS_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Old VOS">
                                    Open Old VOS <ExternalLink className="ml-2 h-4 w-4" />
                                </a>
                            </Button>
                            <ModeToggle />
                        </div>

                        <div className={cn("mt-3 grid gap-4 lg:grid-cols-[1fr_520px] lg:items-start", isCompactHeader && "mt-2")}>
                            <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                    <div className={cn("inline-flex items-center justify-center rounded-2xl border bg-background/70 shadow-sm", isCompactHeader ? "h-9 w-9" : "h-10 w-10")}>
                                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                      <span className={cn("font-semibold tracking-tight", isCompactHeader ? "text-base" : "text-lg sm:text-xl")}>
                        VOS ERP
                      </span>
                                            <Badge variant="secondary" className="h-6 px-2 text-[12px]">
                                                Internal
                                            </Badge>
                                        </div>

                                        {!isCompactHeader ? (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Subsystems overview (filtered by position access).
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className={cn("mt-3 flex flex-wrap items-center gap-2", !isCompactHeader && "mt-4")}>
                                    <Badge variant="secondary" className="h-6 px-2 text-[12px]">
                                        Visible Subsystems: {positionFiltered.length}
                                    </Badge>
                                    <Badge variant="secondary" className="h-6 px-2 text-[12px]">
                                        Active (Visible): {totalActiveVisible}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Search subsystems/submodules…"
                                        className="pl-9 bg-background/70 backdrop-blur"
                                    />
                                </div>

                                {!isCompactHeader ? (
                                    <div className="text-xs text-muted-foreground text-right italic font-medium">
                                        Access is strictly enforced based on your assigned permissions.
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* CONTENT (push down for fixed header) */}
            <main
                className="mx-auto w-full max-w-[1400px] px-4 pb-24 sm:px-8 sm:pb-28 flex-1"
                style={{ paddingTop: headerOffset }}
            >
                <div className="space-y-8">
                    {loadingPermissions ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Activity className="h-10 w-10 text-primary animate-pulse" />
                            <p className="text-sm font-bold tracking-tighter text-muted-foreground uppercase">Verifying Access Permissions...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <Card className="border bg-background/50 p-8 backdrop-blur">
                            <div className="text-sm text-muted-foreground">
                                {q.trim() 
                                    ? `No visible subsystems match "${q.trim()}" for your account.` 
                                    : "You do not have access to any subsystems. Please contact your Administrator."}
                            </div>
                        </Card>
                    ) : (
                        grouped.map((group) => {
                            const meta = CATEGORY_META[group.category];
                            return (
                                <div key={group.category}>
                                    <div className="mb-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-semibold">{meta.title}</div>
                                            <span className="inline-flex items-center rounded-full bg-zinc-900/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 ring-1 ring-zinc-900/10 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10">
                        {group.items.length} Subsystems
                      </span>
                                        </div>
                                        <div className="mt-1 text-xs text-muted-foreground">{meta.description}</div>
                                    </div>

                                    <Card className="border bg-background/50 p-4 backdrop-blur">
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {group.items.map((s) => (
                                                <SubsystemTile key={s.id} subsystem={s} />
                                            ))}
                                        </div>

                                        <Separator className="mt-4 opacity-70" />
                                        <div className="mt-3 text-xs text-muted-foreground">
                                            Coming Soon subsystems remain non-clickable.
                                        </div>
                                    </Card>
                                </div>
                            );
                        })
                    )}
                </div>
            </main>

            <DashboardFooter />
        </div>
    );
}

function SubsystemTile({ subsystem }: { subsystem: SubsystemItem }) {
    const isComing = subsystem.status === "comingSoon";
    const Icon = subsystem.icon;

    const content = (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border bg-background/70 p-4 shadow-sm backdrop-blur",
                "transition-all duration-200",
                "hover:border-zinc-900/10 dark:hover:border-white/10",
                isComing && "cursor-not-allowed"
            )}
        >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-2xl" />
                <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/15 blur-2xl" />
            </div>

            <div className="relative flex items-start gap-3">
                <div
                    className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border bg-background/70 shadow-sm backdrop-blur",
                        subsystem.accentClass
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold">{subsystem.title}</div>
                        {subsystem.tag ? (
                            <span className="inline-flex items-center rounded-full bg-zinc-900/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 ring-1 ring-zinc-900/10 dark:bg-white/5 dark:text-zinc-200 dark:ring-white/10">
                {subsystem.tag}
              </span>
                        ) : null}
                    </div>

                    {subsystem.subtitle ? (
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {subsystem.subtitle}
                        </div>
                    ) : null}

                    <div className="mt-2 text-[11px] text-muted-foreground">
                        Category: {subsystem.category}
                    </div>
                </div>

                <div className="mt-1 text-muted-foreground">
                    {isComing ? (
                        <Timer className="h-4 w-4 opacity-80" />
                    ) : (
                        <ArrowUpRight className="h-4 w-4 opacity-80 transition group-hover:opacity-100" />
                    )}
                </div>
            </div>

            <div className="relative mt-4 flex items-end justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {subsystem.submodules.map((m) => (
                        <Badge
                            key={m.id}
                            variant="secondary"
                            className={cn(
                                "h-5 px-2 text-[11px] font-medium",
                                m.status === "comingSoon" && "opacity-80"
                            )}
                            title={m.status === "comingSoon" ? "Coming Soon" : "Active"}
                        >
                            {m.title}
                        </Badge>
                    ))}
                </div>

                <div className="shrink-0">
                    <StatusBadge status={subsystem.status} />
                </div>
            </div>

            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-primary/20 transition group-hover:ring-2" />
        </div>
    );

    if (isComing || !subsystem.href) return <HoverLift disabled>{content}</HoverLift>;

    return (
        <HoverLift>
            <Link
                href={subsystem.href}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
                aria-label={`Open ${subsystem.title}`}
            >
                {content}
            </Link>
        </HoverLift>
    );
}
