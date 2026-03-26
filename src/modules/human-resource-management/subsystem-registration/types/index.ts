export type SubsystemStatus = "active" | "comingSoon";

export interface SubModuleRegistration {
    id: string;
    slug: string;
    title: string;
    base_path: string;
    status: SubsystemStatus;
}

export interface ModuleRegistration {
    id: string;
    slug: string;
    title: string;
    base_path: string;
    status: SubsystemStatus;
    subModules: SubModuleRegistration[];
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
