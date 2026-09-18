import { Suspense } from "react";
import { ApplicationFormModule } from "@/modules/human-resource-management/application-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ApplicationFormPage() {
    return (
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
            <Suspense
                fallback={
                    <div className="p-6 text-sm text-muted-foreground">Loading application form...</div>
                }
            >
                <ApplicationFormModule />
            </Suspense>
        </main>
    );
}
