import * as React from "react";
import { type ComponentProps } from "react";
import { AppSidebarClient } from "./app-sidebar-client";
import { getSidebarNavigation } from "../_actions/sidebar";
import { Sidebar } from "@/components/ui/sidebar";

export async function AppSidebar(props: ComponentProps<typeof Sidebar>) {
    // 1. Fetch data on the server (Directly from Spring Boot)
    // No more "use client" fetch delays or skeletons!
    const items = await getSidebarNavigation();

    return (
        <AppSidebarClient 
            {...props} 
            initialItems={items} 
        />
    );
}
