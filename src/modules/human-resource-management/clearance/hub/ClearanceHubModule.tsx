"use client";

import { Suspense } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ClearanceHubProvider } from "./providers/ClearanceHubProvider";
import { ClearanceHubOverview } from "./components/HubOverview";
import ClearanceFormModule from "./form";
import ClearanceSoaModule from "./soa";
import ClearanceQuitClaimsModule from "./quit-claims";
import { parseClearanceHubTab } from "./utils/documentTabs";

function ClearanceHubModuleInner(): JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const tab = parseClearanceHubTab(searchParams.get("tab"));

    function handleTabChange(next: string): void {
        const parsed = parseClearanceHubTab(next);
        const params = new URLSearchParams(searchParams.toString());
        if (parsed === "overview") {
            params.delete("tab");
        } else {
            params.set("tab", parsed);
        }
        params.delete("request");
        params.delete("print");
        const query = params.toString();
        router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    }

    return (
        <ClearanceHubProvider>
            <Suspense>
                <Tabs value={tab} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="form">Clearance Form</TabsTrigger>
                        <TabsTrigger value="soa">SOA</TabsTrigger>
                        <TabsTrigger value="quit-claims">Quit Claims</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview">
                        <ClearanceHubOverview />
                    </TabsContent>
                    <TabsContent value="form">
                        <ClearanceFormModule />
                    </TabsContent>
                    <TabsContent value="soa">
                        <ClearanceSoaModule />
                    </TabsContent>
                    <TabsContent value="quit-claims">
                        <ClearanceQuitClaimsModule />
                    </TabsContent>
                </Tabs>
            </Suspense>
        </ClearanceHubProvider>
    );
}

export default function ClearanceHubModule(): JSX.Element {
    return (
        <Suspense>
            <ClearanceHubModuleInner />
        </Suspense>
    );
}
