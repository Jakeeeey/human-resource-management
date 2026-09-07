"use client";

import React from 'react';
import { ManpowerRecommendationProvider } from "./providers/ManpowerRecommendationProvider";
import { useManpowerRecommendation } from "./hooks/useManpowerRecommendation";
import { OpenManpowerRequestsList } from "./components/OpenManpowerRequestsList";
import { ManpowerRequestDetail } from "./components/ManpowerRequestDetail";
import { ManpowerRecommendationForm } from "./components/ManpowerRecommendationForm";
import { ManpowerRecommendationView } from "./components/ManpowerRecommendationView";
import { Button } from "@/components/ui/button";

import { Users, RefreshCw } from "lucide-react";

function ManpowerRecommendationContent() {
    const { refresh } = useManpowerRecommendation();
    return (
        <div className="p-2 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            Manpower Recommendations
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-base sm:text-lg">
                            Recommend applicants to open manpower requests.
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => refresh()} className="w-full sm:w-auto">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="relative z-10">
                <OpenManpowerRequestsList />
            </div>
            <ManpowerRequestDetail />
            <ManpowerRecommendationForm />
            <ManpowerRecommendationView />
        </div>
    );
}

export function ManpowerRecommendationModule() {
    return (
        <ManpowerRecommendationProvider>
            <ManpowerRecommendationContent />
        </ManpowerRecommendationProvider>
    );
}
