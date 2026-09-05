"use client";

import React from 'react';
import { ManpowerRecommendationProvider } from "./providers/ManpowerRecommendationProvider";
import { OpenManpowerRequestsList } from "./components/OpenManpowerRequestsList";
import { ManpowerRequestDetail } from "./components/ManpowerRequestDetail";
import { ManpowerRecommendationForm } from "./components/ManpowerRecommendationForm";
import { ManpowerRecommendationView } from "./components/ManpowerRecommendationView";

import { Users } from "lucide-react";

function ManpowerRecommendationContent() {
    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-2 mb-2 relative z-10">
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
