"use client";

import { Monitor, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

export type StudioDevice = "desktop" | "mobile";

export const STUDIO_DEVICE_WIDTHS: Record<StudioDevice, number> = {
    desktop: 600,
    mobile: 375,
};

const DEVICE_OPTIONS: readonly {
    readonly id: StudioDevice;
    readonly label: string;
}[] = [
    { id: "desktop", label: "Desktop 600 pixels" },
    { id: "mobile", label: "Mobile 375 pixels" },
];

/**
 * Segmented device control (DESIGN.md §5.1): track bg-muted, active segment
 * bg-card + shadow, aria-pressed conveys state. Shared by the top bar and
 * the Settings panel so both mirrors stay identical.
 */
export function DeviceSwitch({
    device,
    onChange,
}: {
    readonly device: StudioDevice;
    readonly onChange: (next: StudioDevice) => void;
}) {
    return (
        <div aria-label="Device width" className="flex items-center rounded-md bg-muted p-0.5" role="group">
            {DEVICE_OPTIONS.map(({ id, label }) => {
                const Icon = id === "desktop" ? Monitor : Smartphone;
                const isActive = device === id;
                return (
                    <button
                        aria-label={label}
                        aria-pressed={isActive}
                        className={cn(
                            "flex h-7 w-8 items-center justify-center rounded transition-colors duration-150",
                            isActive
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                        key={id}
                        type="button"
                        onClick={() => onChange(id)}
                    >
                        <Icon aria-hidden="true" className="size-4" />
                    </button>
                );
            })}
        </div>
    );
}
