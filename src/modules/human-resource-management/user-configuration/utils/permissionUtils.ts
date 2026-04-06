import { SubsystemRegistration, ModuleRegistration } from "@/modules/human-resource-management/subsystem-registration/types";

/**
 * Recursively extracts all slugs (subsystem, modules, and sub-modules)
 * from a given subsystem or module.
 */
export function extractAllSlugs(item: SubsystemRegistration | ModuleRegistration): string[] {
    let slugs: string[] = [item.slug];

    if ("modules" in item && item.modules) {
        item.modules.forEach(mod => {
            slugs = [...slugs, ...extractAllSlugs(mod)];
        });
    }

    if ("subModules" in item && item.subModules) {
        item.subModules.forEach(sub => {
            slugs = [...slugs, ...extractAllSlugs(sub)];
        });
    }

    return slugs;
}
