import { SubsystemRegistration } from "@/modules/human-resource-management/subsystem-registration/types";

// Initial mock data based on the main dashboard
const INITIAL_SUBSYSTEMS: SubsystemRegistration[] = [
    {
        id: "scm",
        slug: "scm",
        title: "Supply Chain",
        subtitle: "Procurement, inventory, logistics, distribution operations",
        base_path: "/scm",
        icon_name: "Boxes",
        status: "comingSoon",
        category: "Operations",
        tag: "SCM",
        modules: [],
    },
    {
        id: "crm",
        slug: "crm",
        title: "Customer Relationship",
        subtitle: "Customers, accounts, pipeline, quotations, after-sales linkage",
        base_path: "/crm",
        icon_name: "Users",
        status: "comingSoon",
        category: "Customer & Engagement",
        tag: "CRM",
        modules: [],
    },
    {
        id: "finance",
        slug: "finance",
        title: "Financial Management",
        subtitle: "General ledger, AR/AP, budgeting, cash & bank, compliance",
        base_path: "/fm",
        icon_name: "Landmark",
        status: "comingSoon",
        category: "Corporate Services",
        tag: "FIN",
        modules: [],
    },
    {
        id: "hr",
        slug: "hr",
        title: "Human Resources",
        subtitle: "Timekeeping, payroll, benefits, employee master, performance",
        base_path: "/hrm",
        icon_name: "Settings",
        status: "active",
        category: "Corporate Services",
        tag: "HR",
        modules: [
            {
                id: "hr-m1",
                slug: "employee-admin",
                title: "Employee Admin",
                base_path: "/hrm/employee-admin",
                status: "active",
                subModules: [
                    { id: "hr-sm1", slug: "master-list", title: "Employee Master List", base_path: "/hrm/employee-admin/master-list", status: "active" },
                    { id: "hr-sm2", slug: "administrator", title: "Administrator", base_path: "/hrm/employee-admin/administrator", status: "active" },
                ]
            }
        ],
    },
    {
        id: "mfg",
        slug: "mfg",
        title: "Manufacturing",
        subtitle: "Production planning, BOM, work orders, quality, WIP tracking",
        base_path: "/manufacturing",
        icon_name: "Factory",
        status: "comingSoon",
        category: "Operations",
        tag: "MFG",
        modules: [],
    },
    {
        id: "pm",
        slug: "pm",
        title: "Project Management",
        subtitle: "Projects, tasks, assignments, timelines, deliverables, costing",
        base_path: "/projects",
        icon_name: "FolderKanban",
        status: "comingSoon",
        category: "Operations",
        tag: "PM",
        modules: [],
    },
    {
        id: "arf",
        slug: "arf",
        title: "Audit & Findings",
        subtitle: "Audit issues, corrective actions, evidence, compliance follow-up",
        base_path: "/arf",
        icon_name: "ShieldCheck",
        status: "comingSoon",
        category: "Governance & Assurance",
        tag: "ARF",
        modules: [],
    },
    {
        id: "comms",
        slug: "comms",
        title: "Communications",
        subtitle: "Announcements, messaging, notifications, tickets/case linkage",
        base_path: "/comms",
        icon_name: "MessagesSquare",
        status: "comingSoon",
        category: "Customer & Engagement",
        tag: "COMMS",
        modules: [],
    },
    {
        id: "pm-monitoring",
        slug: "pm-monitoring",
        title: "PM Monitoring",
        subtitle: "Program monitoring, KPIs, status tracking, escalation visibility",
        base_path: "/pm-monitoring",
        icon_name: "Activity",
        status: "comingSoon",
        category: "Monitoring & Oversight",
        tag: "PMO",
        modules: [],
    },
    {
        id: "bia",
        slug: "bia",
        title: "Business Intelligence",
        subtitle: "Dashboards, KPIs, performance analytics, drill-down reporting",
        base_path: "/bia",
        icon_name: "BarChart3",
        status: "comingSoon",
        category: "Monitoring & Oversight",
        tag: "BIA",
        modules: [],
    },
];

export class SubsystemService {
    static async getSubsystems(): Promise<SubsystemRegistration[]> {
        // Return local storage if exists, otherwise initial data
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("vos_subsystems_registry");
            if (saved) return JSON.parse(saved);
        }
        return INITIAL_SUBSYSTEMS;
    }

    static async saveSubsystems(subsystems: SubsystemRegistration[]): Promise<void> {
        if (typeof window !== "undefined") {
            localStorage.setItem("vos_subsystems_registry", JSON.stringify(subsystems));
        }
    }
}
