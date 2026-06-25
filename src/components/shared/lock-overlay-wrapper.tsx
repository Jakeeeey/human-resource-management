"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LockOverlayWrapperProps {
    initialLocked: boolean;
    children: React.ReactNode;
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() ?? null;
    return null;
}

export function LockOverlayWrapper({ initialLocked, children }: LockOverlayWrapperProps) {
    const pathname = usePathname();
    const [isLocked, setIsLocked] = React.useState(initialLocked);

    React.useEffect(() => {
        const lockedCookie = getCookie("x-locked-module");
        setIsLocked(lockedCookie === "true");
    }, [pathname]);

    if (!isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {/* Blurred page content container */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 select-none pointer-events-none filter blur-[3px] opacity-40">
                {children}
            </div>
            {/* Premium Glassmorphism Lock Overlay */}
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/30 backdrop-blur-[1px] p-4 sm:p-6 animate-in fade-in duration-300">
                <div className="max-w-md w-full rounded-2xl border border-border/80 bg-card/85 backdrop-blur-md shadow-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="size-16 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-inner animate-pulse">
                        <Lock className="size-8" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-2xl font-black tracking-tighter text-foreground">
                            Module Access Locked
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            This enterprise module is not included in your current subscription plan. Please upgrade your tier to unlock access.
                        </p>
                    </div>
                    <Button 
                        className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 font-bold tracking-tight text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 transition-all flex items-center justify-center gap-2"
                    >
                        <Sparkles className="size-4" />
                        Upgrade Subscription Plan
                    </Button>
                </div>
            </div>
        </div>
    );
}
