"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Users, // Employee Admin
    UserRound, // Employee Master List
    Shield, // Administrator
    CalendarClock, // Admin > Department Schedule
    Network, // Structure (replaces Sitemap)
    Building2, // Division
    UserCog, // Salesman
    Building, // Company Profile
    Layers, // Department
    KeyRound, // Department Accounts
    BadgeCheck, // Role Management
    Boxes, // Subsystem Registration
    Brush, // PDF Layout Designer
    type LucideIcon,
} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePermissionsStore } from "@/stores/usePermissionsStore";
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

const data = {
    navMain: [
        {
            title: "Employee Admin",
            url: "#",
            slug: "employee-admin",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Employee Master List",
                    url: "/hrm/employee-admin/employee-master-list",
                    slug: "employee-admin-master-list",
                    icon: UserRound,
                },
                {
                    title: "Administrator",
                    url: "#",
                    slug: "administrator",
                    icon: Shield,
                    items: [
                        {
                            title: "Department Schedule",
                            url: "/hrm/employee-admin/administrator/department-schedule",
                            slug: "department-schedule",
                            icon: CalendarClock,
                        },
                        {
                            title: "On Call",
                            url: "/hrm/employee-admin/administrator/on-call",
                            slug: "on-call",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Structure",
                    url: "#",
                    slug: "structure",
                    icon: Network,
                    items: [
                        {
                            title: "Division",
                            url: "/hrm/employee-admin/structure/division",
                            slug: "division",
                            icon: Building2,
                        },
                        {
                            title: "Company Profile",
                            url: "/hrm/employee-admin/structure/company-profile",
                            slug: "company-profile",
                            icon: Building,
                        },
                        {
                            title: "Department",
                            url: "/hrm/employee-admin/structure/department",
                            slug: "department",
                            icon: Layers,
                        },
                        {
                            title: "Department Accounts",
                            url: "/hrm/employee-admin/structure/department-accounts",
                            slug: "department-accounts",
                            icon: KeyRound,
                        },
                        {
                            title: "Role Management",
                            url: "/hrm/employee-admin/structure/role-management",
                            slug: "role-management",
                            icon: BadgeCheck,
                        },
                        {
                            title: "Operation",
                            url: "/hrm/employee-admin/structure/operation",
                            slug: "operation",
                            icon: BadgeCheck,
                        },
                        {
                            title: "Industry",
                            url: "/hrm/employee-admin/structure/industry",
                            slug: "industry",
                            icon: BadgeCheck,
                        },

                    ],
                },
                {
                    title: "Sales Management",
                    url: "#",
                    slug: "sales-management",
                    icon: UserCog,
                    items: [
                        {
                            title: "Salesman Creation",
                            url: "/hrm/employee-admin/structure/sales-management/salesman-creation",
                            slug: "salesman-creation",
                            icon: UserCog,
                        },
                        {
                            title: "Salesman QR Code",
                            url: "/hrm/employee-admin/structure/sales-management/salesman-qr-code",
                            slug: "salesman-qr-code",
                            icon: UserCog,
                        },
                    ],
                },

                {
                    title: "Approval",
                    url: "#",
                    slug: "approval",
                    icon: Shield,
                    items: [
                        {
                            title: "Attendance Approval",
                            url: "/hrm/employee-admin/approval/attendance-approval",
                            slug: "attendance-approval",
                            icon: CalendarClock,
                        },
                        {
                            title: "Overtime Approval",
                            url: "/hrm/employee-admin/approval/overtime-request",
                            slug: "overtime-request",
                            icon: CalendarClock,
                        },
                        {
                            title: "Undertime Approval",
                            url: "/hrm/employee-admin/approval/undertime-approval",
                            slug: "undertime-approval",
                            icon: CalendarClock,
                        },
                        {
                            title: "Leave Approval",
                            url: "/hrm/employee-admin/approval/leave-approval",
                            slug: "leave-approval",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Report",
                    url: "#",
                    slug: "report",
                    icon: Shield,
                    items: [
                        {
                            title: "Overtime Report",
                            url: "/hrm/employee-admin/report/overtime-report",
                            slug: "overtime-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Undertime Report",
                            url: "/hrm/employee-admin/report/undertime-report",
                            slug: "undertime-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Leave Report",
                            url: "/hrm/employee-admin/report/leave-report",
                            icon: CalendarClock,
                        },
                    ],
                },
            ],
        },
        {
            title: "User Configuration",
            url: "/hrm/user-configuration",
            slug: "user-configuration",
            icon: UserCog,
        },
        {
            title: "Subsystem Registration",
            url: "/hrm/subsystem-registration",
            slug: "subsystem-registration",
            icon: Boxes,
        },
        {
            title: "PDF Layout",
            url: "/hrm/pdf-layout",
            slug: "pdf-layout",
            icon: Brush,
        },
        {
            title: "Workforce",
            url: "#",
            slug: "workforce",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Attendance Report",
                    url: "#",
                    slug: "attendance-report",
                    items: [
                        {
                            title: "Today's Report",
                            url: "/hrm/workforce/attendance-report/todays-report",
                            slug: "todays-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Employee Report",
                            url: "/hrm/workforce/attendance-report/employee-report",
                            slug: "employee-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Department Report",
                            url: "/hrm/workforce/attendance-report/department-report",
                            slug: "department-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Logistics Report",
                            url: "/hrm/workforce/attendance-report/logistics-report",
                            slug: "logistics-report",
                            icon: CalendarClock,
                        },
                    ],
                },

                {
                    title: "Attendance Management",
                    url: "/hrm/workforce/attendance-management",
                    slug: "attendance-management",
                    icon: CalendarClock,
                },
                {
                    title: "Job Orders",
                    url: "#",
                    slug: "job-orders",
                    items: [
                        {
                            title: "Application Management",
                            url: "/hrm/workforce/job-orders/application-management",
                            slug: "application-management",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Asset Tagging",
                    url: "/hrm/workforce/asset-tagging",
                    slug: "asset-tagging",
                    icon: CalendarClock,
                },
                {
                    title: "Asset Investigation",
                    url: "/hrm/workforce/asset-investigation",
                    slug: "asset-investigation",
                    icon: CalendarClock,
                },
            ],
        },
        {
            title: "Communications",
            url: "#",
            slug: "communications",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Policies",
                    url: "/hrm/communications/policies",
                    slug: "policies",
                    icon: CalendarClock,
                },
                {
                    title: "Memorandums",
                    url: "/hrm/communications/memorandums",
                    slug: "memorandums",
                    icon: CalendarClock,
                },
                {
                    title: "Notices",
                    url: "#",
                    slug: "notices",
                    items: [
                        {
                            title: "NTE",
                            url: "/hrm/communications/notices/nte",
                            slug: "nte",
                            icon: CalendarClock,
                        },
                        {
                            title: "NOD",
                            url: "/hrm/communications/notices/nod",
                            slug: "nod",
                            icon: CalendarClock,
                        },
                        {
                            title: "CARE",
                            url: "/hrm/communications/notices/care",
                            slug: "care",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Announcement",
                    url: "hrm/communications/announcement",
                    slug: "announcement",
                    icon: CalendarClock,
                },
                {
                    title: "Cooperatives",
                    url: "/hrm/communication/cooperatives",
                    slug: "cooperatives",
                    icon: CalendarClock,
                },
            ],
        },
        {
            title: "File Management",
            url: "#",
            slug: "file-management",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Employee File Type",
                    url: "/hrm/file-management/employee-file-record-type",
                    slug: "employee-file-record-type",
                    icon: Shield,
                },
                {
                    title: "Employee File List",
                    url: "/hrm/file-management/employee-file-record-list",
                    slug: "employee-file-record-list",
                    icon: Shield,
                },


            ],

        },
    ],
};

export function AppSidebar({
    className,
    ...props
}: React.ComponentProps<typeof Sidebar>) {
    const { permissions, isAdmin, isLoading, fetchPermissions } = usePermissionsStore();
    
    React.useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    // Recursive function to filter nav items
    const filteredNavMain = React.useMemo(() => {
        if (isLoading) return [];
        if (isAdmin) return data.navMain; // ADMIN BYPASS: Show everything

        interface NavItem {
            title: string;
            url: string;
            slug?: string;
            icon?: LucideIcon;
            items?: NavItem[];
        }

        function filterItems(items: NavItem[]): NavItem[] {
            return items
                .map((item) => {
                    // Use the explicit slug if provided, else derive from URL
                    const slug = item.slug || item.url.replace(/^\//, "");
                    
                    // Use exact matching to respect granular permissions
                    const isAuthorized = permissions.includes(slug);

                    // If it has children, recursively filter them
                    if (item.items) {
                        const authorizedChildren = filterItems(item.items);
                        // Parent is visible if it's explicitly authorized OR has authorized children
                        if (isAuthorized || authorizedChildren.length > 0) {
                            return { ...item, items: authorizedChildren };
                        }
                        return null;
                    }

                    // For leaf items, must be explicitly authorized (either direct or via parent subsystem)
                    return isAuthorized ? item : null;
                })
                .filter((item): item is NavItem => item !== null);
        }

        return filterItems(data.navMain as NavItem[]);
    }, [permissions, isAdmin, isLoading]);

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

            <SidebarContent>
                <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-widest opacity-50">
                    Platform
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
                            <NavMain items={filteredNavMain} />
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
