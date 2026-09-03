import { Suspense } from "react";
import { ApplicationFormModule } from "@/modules/human-resource-management/application-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lives at /hrm/application-form (so its URL matches every other sidebar
// module) but is physically inside the (applicant) route group, not
// (human-resource-management) -- so it still renders through the chrome-less
// layout (no sidebar/header), not the normal HR app shell. The /hrm prefix
// does mean middleware auth-gates this page like any other module (login
// required, per-module authorization via user_access_modules) -- see
// playbook-erp-human-resource-management-architecture.md sec 19 AMENDMENT.
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
