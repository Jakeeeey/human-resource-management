"use client";

import { HandbookProvider } from "./providers/HandbookProvider";
import { HandbookList } from "./components/HandbookList";
import { HandbookForm } from "./components/HandbookForm";
import { HandbookDetail } from "./components/HandbookDetail";

export default function HandbookPage() {
    return (
        <HandbookProvider>
            <div className="flex flex-col space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Company Handbook</h1>
                    <p className="text-muted-foreground">
                        Manage and view all company policies, guidelines, and handbooks.
                    </p>
                </div>
                
                <HandbookList />
                <HandbookForm />
                <HandbookDetail />
            </div>
        </HandbookProvider>
    );
}
