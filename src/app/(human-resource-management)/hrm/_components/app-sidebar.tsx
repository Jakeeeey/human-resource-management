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
    CalendarDays, // Structure > Department Schedule
    KeyRound, // Department Accounts
    BadgeCheck, // Role Management
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
            items: [
                {
                    title: "Employee Master List",
                    url: "/hrm/employee-admin/employee-master-list",
                    icon: UserRound,
                    isActive: true,
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
                            title: "Department Schedule",
                            url: "/hrm/employee-admin/structure/department-schedule",
                            icon: CalendarDays,
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
                    ],
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
