"use client";

import type { JSX } from "react";
import { Settings2 } from "lucide-react";

import { TemplatesWorkspace } from "./components/TemplatesWorkspace";
import { ClearanceTemplatesFetchProvider } from "./providers/clearanceTemplatesProvider";

export function ClearanceTemplatesModule(): JSX.Element {
    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl shrink-0">
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
                <TemplatesWorkspace />
            </ClearanceTemplatesFetchProvider>
        </div>
    );
}
