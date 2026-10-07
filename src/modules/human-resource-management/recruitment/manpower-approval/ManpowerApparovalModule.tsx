"use client";

import { ManpowerApprovalProvider } from "./providers/ManpowerApprovalProvider";
import { ManpowerApprovalList } from "./components/ManpowerApprovalList";
import { ManpowerApprovalView } from "./components/ManpowerApprovalView";

export function ManpowerApprovalModule() {
    return (
        <ManpowerApprovalProvider>
            <div className="w-full animate-in fade-in duration-500 pb-12">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 px-1">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <span className="bg-primary/10 p-2.5 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                            </span>
                            Manpower Approval
                        </h1>
                        <p className="text-muted-foreground text-lg ml-1">
                            Review and approve pending departmental manpower requests.
                        </p>
                    </div>
                </div>

                <ManpowerApprovalList />
                <ManpowerApprovalView />
            </div>
        </ManpowerApprovalProvider>
    );
}
