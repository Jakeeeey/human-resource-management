export type SubsystemStatus = "active" | "comingSoon";

export interface ModuleRegistration {
    id: string;
    slug: string;
    title: string;
    base_path: string;
    status: SubsystemStatus;
    icon_name?: string;
    subModules?: ModuleRegistration[];
}

export interface SubsystemRegistration {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    base_path: string;
    icon_name: string;
    status: SubsystemStatus;
    category: string;
    tag?: string;
    modules: ModuleRegistration[];
}

export const SUBSYSTEM_CATEGORIES = [
    "Operations",
    "Customer & Engagement",
    "Corporate Services",
    "Governance & Assurance",
    "Monitoring & Oversight",
];
