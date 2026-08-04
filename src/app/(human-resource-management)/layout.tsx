import * as React from "react";

import { AppSidebar } from "@/app/(human-resource-management)/hrm/_components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { headers, cookies } from "next/headers";
import { LockOverlayWrapper } from "@/components/shared/lock-overlay-wrapper";

export default async function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const headerList = await headers();
    const cookieStore = await cookies();
    const isLocked = headerList.get("x-locked-module") === "true" || cookieStore.get("x-locked-module")?.value === "true";

    return (
        <SidebarProvider>
            <AppSidebar />

            {/* ✅ RIGHT column should be part of the body (NOT floating/inset card) */}
            <SidebarInset className="min-w-0 flex h-[100dvh] flex-col overflow-hidden bg-background p-0 m-0 rounded-none border-0 shadow-none relative">
                <LockOverlayWrapper initialLocked={isLocked}>
                    {children}
                </LockOverlayWrapper>
            </SidebarInset>
        </SidebarProvider>
    );
}
