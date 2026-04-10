import * as React from "react";
import { type ComponentProps } from "react";
import { AppSidebarClient } from "./app-sidebar-client";
import { getSidebarNavigation } from "../_actions/sidebar";
import { Sidebar } from "@/components/ui/sidebar";

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
    // 1. Fetch data on the server (Directly from Spring Boot)
    // No more "use client" fetch delays or skeletons!
    const items = await getSidebarNavigation();

<<<<<<< HEAD
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
                    title: "Sales Management",
                    url: "#",
                    icon: UserCog,
                    items: [
                        {
                            title: "Salesman Creation",
                            url: "/hrm/employee-admin/structure/sales-management/salesman-creation",
                            icon: UserCog,
                        },
                        {
                            title: "Salesman QR Code",
                            url: "/hrm/employee-admin/structure/sales-management/salesman-qr-code",
                            icon: UserCog,
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
                            url: "/hrm/workforce/attendance-report/todays-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Employee Report",
                            url: "/hrm/workforce/attendance-report/employee-report",
                            icon: CalendarClock,
                        },
                        {
                            title: "Department Report",
                            url: "/hrm/workforce/attendance-report/department-report",
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
=======
>>>>>>> c1f01f4099f6cdd02f56f81ffc836b4ec58bd25c
    return (
        <AppSidebarClient 
            {...props} 
            initialItems={items} 
        />
    );
}
