"use client";

import React from 'react';
import { InterviewProvider, type InterviewStageTab } from "./providers/InterviewProvider";
import { InterviewEligibleList } from "./components/InterviewEligibleList";
import { InterviewDetail } from "./components/InterviewDetail";

import { ClipboardList } from "lucide-react";

function InterviewsContent() {
    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-2 mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <ClipboardList className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                            Interviews
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-lg">
                            Grade initial and final applicant interviews.
                        </p>
                    </div>
                </div>
            </div>

            <div className="relative z-10">
                <InterviewEligibleList />
            </div>
            <InterviewDetail />
        </div>
    );
}

export function InterviewsModule({ initialStage = "Initial" }: { initialStage?: InterviewStageTab }) {
    return (
        <InterviewProvider initialStage={initialStage}>
            <InterviewsContent />
        </InterviewProvider>
    );
}
