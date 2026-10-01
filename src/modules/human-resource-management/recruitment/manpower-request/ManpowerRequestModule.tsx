"use client";

import React from 'react';
import { ManpowerRequestProvider } from "./providers/ManpowerRequestProvider";
import { ManpowerRequestList } from "./components/ManpowerRequestList";
import { ManpowerRequestForm } from "./components/ManpowerRequestForm";
import { ManpowerRequestView } from "./components/ManpowerRequestView";

import { Users, Sparkles } from "lucide-react";

function ManpowerRequestContent() {
    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen space-y-8">
            <div className="flex flex-col gap-2 mb-2 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-sm border border-primary/20">
                        <Users className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-2">
                            Manpower Requests
                            <Sparkles className="w-5 h-5 text-primary/40 animate-pulse" />
                        </h1>
                        <p className="text-muted-foreground/80 font-medium mt-1 text-lg">
                            Manage and track departmental manpower requests securely.
                        </p>
                    </div>
                </div>
            </div>
            
            <div className="relative z-10">
                <ManpowerRequestList />
            </div>
            <ManpowerRequestForm />
            <ManpowerRequestView />
        </div>
    );
}

export function ManpowerRequestModule() {
    return (
        <ManpowerRequestProvider>
            <ManpowerRequestContent />
        </ManpowerRequestProvider>
    );
}
