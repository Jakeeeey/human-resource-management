"use client";

import type { JSX } from "react";
import { useState } from "react";
import { Settings2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SoaTemplateCatalogue } from "./components/SoaTemplateCatalogue";
import { TemplateCatalogue } from "./components/TemplateCatalogue";
import { ClearanceTemplatesFetchProvider } from "./providers/clearanceTemplatesProvider";
import { SoaTemplatesFetchProvider } from "./providers/soaTemplatesProvider";

type TemplatesTab = "clearance" | "soa";

export function ClearanceTemplatesModule(props: { selectedId?: number | null }): JSX.Element {
    const { selectedId = null } = props;
    const [tab, setTab] = useState<TemplatesTab>("clearance");

    return (
        <div className="mx-auto min-h-screen max-w-[1600px] space-y-6 p-2 sm:p-6 md:p-10">
            <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-2xl bg-primary/10 p-3">
                    <Settings2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight" title="Clearance Templates">
                        Clearance Templates
                    </h1>
                    <p className="text-base text-muted-foreground">
                        Which clearance categories apply, and who may sign each one.
                    </p>
                </div>
            </div>

            <Tabs
                value={tab}
                onValueChange={(next) => {
                    if (next === "clearance" || next === "soa") {
                        setTab(next);
                    }
                }}
                className="space-y-4"
            >
                <TabsList className="group-data-[orientation=horizontal]/tabs:h-auto w-full flex-wrap justify-start gap-1">
                    <TabsTrigger value="clearance" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">Clearance Form</TabsTrigger>
                    <TabsTrigger value="soa" className="min-h-11 shrink-0 md:min-h-0 text-base data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:text-primary-foreground">SOA</TabsTrigger>
                </TabsList>
                <TabsContent value="clearance" className="m-0">
                    <ClearanceTemplatesFetchProvider>
                        <TemplateCatalogue selectedId={selectedId} />
                    </ClearanceTemplatesFetchProvider>
                </TabsContent>
                <TabsContent value="soa" className="m-0">
                    <SoaTemplatesFetchProvider>
                        <SoaTemplateCatalogue selectedId={selectedId} />
                    </SoaTemplatesFetchProvider>
                </TabsContent>
            </Tabs>
        </div>
    );
}
