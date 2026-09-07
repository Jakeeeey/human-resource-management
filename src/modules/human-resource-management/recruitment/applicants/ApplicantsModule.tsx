"use client";

import React from "react";
import { ApplicantFilterProvider } from "./providers/filterProvider";
import { ApplicantFetchProvider } from "./providers/fetchProvider";
import { useApplicants } from "./hooks/useApplicants";
import type { ApplicantRow } from "./types";
import { ApplicantsTable } from "./components/Table";
import { ApplicantDetailDrawer } from "./components/ApplicantDetailDrawer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Users } from "lucide-react";

function ApplicantsModuleContent() {
    const { isLoading, isError, error, refresh } = useApplicants();
    const [selected, setSelected] = React.useState<ApplicantRow | null>(null);

    if (isError) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                    <span>Failed to load applicants: {error?.message || "Unknown error"}</span>
                    <Button variant="outline" size="sm" onClick={() => refresh()} className="ml-4">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Applicants
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            Every applicant with their current hiring-pipeline stage.
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refresh()}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>
            <ApplicantsTable onSelect={setSelected} />
            <ApplicantDetailDrawer
                row={selected}
                open={selected !== null}
                onOpenChange={(o) => {
                    if (!o) setSelected(null);
                }}
            />
        </div>
    );
}

export default function ApplicantsModule() {
    return (
        <ApplicantFetchProvider>
            <ApplicantFilterProvider>
                <ApplicantsModuleContent />
            </ApplicantFilterProvider>
        </ApplicantFetchProvider>
    );
}
