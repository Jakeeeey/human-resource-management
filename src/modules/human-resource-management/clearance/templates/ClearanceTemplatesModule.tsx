"use client";

import type { JSX } from "react";
import { Settings2 } from "lucide-react";

import { TemplateCatalogue } from "./components/TemplateCatalogue";
import { ClearanceTemplatesFetchProvider } from "./providers/clearanceTemplatesProvider";

export function ClearanceTemplatesModule(props: { selectedId?: number | null }): JSX.Element {
    const { selectedId = null } = props;
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

            <ClearanceTemplatesFetchProvider>
                <TemplateCatalogue selectedId={selectedId} />
            </ClearanceTemplatesFetchProvider>
        </div>
    );
}
