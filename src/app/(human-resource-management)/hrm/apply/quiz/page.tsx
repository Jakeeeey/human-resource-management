import { Suspense } from "react";
import { AssessmentTakingModule } from "@/modules/human-resource-management/recruitment/assessment-file-management/assessment-taking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ApplyAssessmentPage() {
    return (
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
            <Suspense
                fallback={<div className="p-6 text-sm text-muted-foreground">Loading assessment...</div>}
            >
                <AssessmentTakingModule returnHref="/hrm/apply/done" />
            </Suspense>
        </main>
    );
}
