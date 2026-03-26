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
} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Employee Master List",
                    url: "/hrm/employee-admin/employee-master-list",
                    icon: UserRound,
                },
                {
                    title: "Administrator",
                    url: "#",
                    icon: Shield,
                    items: [
                        {
                            title: "Department Schedule",
                            url: "/hrm/employee-admin/administrator/department-schedule",
                            icon: CalendarClock,
                        },
                        {
                            title: "On Call",
                            url: "/hrm/employee-admin/administrator/on-call",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Structure",
                    url: "#",
                    icon: Network,
                    items: [
                        {
                            title: "Division",
                            url: "/hrm/employee-admin/structure/division",
                            icon: Building2,
                        },
                        {
                            title: "Salesman Management",
                            url: "/hrm/employee-admin/structure/salesman-management/",
                            icon: UserCog,
                        },
                        {
                            title: "Company Profile",
                            url: "/hrm/employee-admin/structure/company-profile",
                            icon: Building,
                        },
                        {
                            title: "Department",
                            url: "/hrm/employee-admin/structure/department",
                            icon: Layers,
                        },
                        {
                            title: "Department Accounts",
                            url: "/hrm/employee-admin/structure/department-accounts",
                            icon: KeyRound,
                        },
                        {
                            title: "Role Management",
                            url: "/hrm/employee-admin/structure/role-management",
                            icon: BadgeCheck,
                        },
                        {
                            title: "Operation",
                            url: "/hrm/employee-admin/structure/operation",
                            icon: BadgeCheck,
                        },
                        {
                            title: "Industry",
                            url: "/hrm/employee-admin/structure/industry",
                            icon: BadgeCheck,
                        },
                    ],
                },
                {
                    title: "Approval",
                    url: "#",
                    icon: Shield,
                    items: [
                        {
                            title: "Attendance Approval",
                            url: "/hrm/employee-admin/approval/attendance-approval",
                            icon: CalendarClock,
                        },
                        {
                            title: "Overtime Request",
                            url: "/hrm/employee-admin/approval/overtime-request",
                            icon: CalendarClock,
                        },
                        {
                            title: "Undertime Approval",
                            url: "/hrm/employee-admin/approval/undertime-approval",
                            icon: CalendarClock,
                        },
                        {
                            title: "Leave Approval",
                            url: "/hrm/employee-admin/approval/leave-approval",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Report",
                    url: "#",
                    icon: Shield,
                    items: [
                        {
                            title: "Overtime Report",
                            url: "/hrm/employee-admin/report/overtime-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Undertime Report",
                            url: "/hrm/employee-admin/report/undertime-report",
                            icon: CalendarClock,
                        },
                    ],
                },
            ],
        },
        {
            title: "User Configuration",
            url: "/hrm/user-configuration",
            icon: UserCog,
        },
        {
            title: "Subsystem Registration",
            url: "/hrm/subsystem-registration",
            icon: Boxes,
        },
        {
            title: "Workforce",
            url: "#",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Attendance Report",
                    url: "#",
                    items: [
                        {
                            title: "Today's Report",
                            url: "/hrm/attendance-report/todays-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Employee Report",
                            url: "/hrm/attendance-report/employee-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Department Report",
                            url: "/hrm/attendance-report/department-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Logistics Report",
                            url: "/hrm/workforce/attendance-report/logistics-report",
                            icon: CalendarClock,
                        },
                    ],
                },

                {
                    title: "Attendance Management",
                    url: "/hrm/workforce/attendance-management",
                    icon: CalendarClock,
                },
                {
                    title: "Job Orders",
                    url: "#",
                    items: [
                        {
                            title: "Application Management",
                            url: "/hrm/workforce/job-orders/application-management",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Asset Tagging",
                    url: "/hrm/workforce/asset-tagging",
                    icon: CalendarClock,
                },
                {
                    title: "Asset Investigation",
                    url: "/hrm/workforce/asset-investigation",
                    icon: CalendarClock,
                },
            ],
        },
        {
            title: "Communications",
            url: "#",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Policies",
                    url: "/hrm/communications/policies",
                    icon: CalendarClock,
                },
                {
                    title: "Memorandums",
                    url: "/hrm/communications/memorandums",
                    icon: CalendarClock,
                },
                {
                    title: "Notices",
                    url: "#",
                    items: [
                        {
                            title: "NTE",
                            url: "/hrm/communications/notices/nte",
                            icon: CalendarClock,
                        },
                        {
                            title: "NOD",
                            url: "/hrm/communications/notices/nod",
                            icon: CalendarClock,
                        },
                        {
                            title: "CARE",
                            url: "/hrm/communications/notices/care",
                            icon: CalendarClock,
                        },
                    ],
                },
                {
                    title: "Announcement",
                    url: "hrm/communications/announcement",
                    icon: CalendarClock,
                },
                {
                    title: "Cooperatives",
                    url: "/hrm/communication/cooperatives",
                    icon: CalendarClock,
                },
            ],
        },
        {
            title: "File Management",
            url: "#",
            icon: Users,
            isActive: false,
            items: [
                {
                    title: "Employee File Type",
                    url: "/hrm/file-management/employee-file-record-type",
                    icon: Shield,
                },
                {
                    title: "Employee File List",
                    url: "/hrm/file-management/employee-file-record-list",
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
                <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
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
                        <NavMain items={data.navMain} />
                    </div>
                </ScrollArea>
            </SidebarContent>

            <SidebarFooter className="p-0">
                <Separator />
                <div className="py-3 text-center text-xs text-muted-foreground">
                    VOS Web v2.0
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
