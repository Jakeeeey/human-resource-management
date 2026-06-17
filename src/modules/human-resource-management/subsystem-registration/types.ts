export type SubsystemStatus = "active" | "comingSoon";

export interface ModuleRegistration {
    id: string | number;
    slug: string;
    title: string;
    base_path: string;
    status: SubsystemStatus;
    icon_name?: string;
    sort?: number;
    parent_module_id?: string | number | null;
    subModules?: ModuleRegistration[];
}

export interface NavItem {
    title: string;
    url: string;
    slug?: string;
    status?: string | SubsystemStatus;
    icon?: React.ComponentType<{ className?: string }>;
    iconName?: string | null;
    items?: NavItem[];
}

export interface SubsystemRegistration {
    id: string | number;
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
