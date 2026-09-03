import { Suspense } from "react";
import { ApplicationFormModule } from "@/modules/human-resource-management/application-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ApplicationFormPage() {
    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-muted-foreground">Loading application form...</div>
            }
        >
            <ApplicationFormModule />
        </Suspense>
    );
}
