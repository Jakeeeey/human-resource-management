"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Neutral end screen for the applicant flow. The applicant never auto-lands in
 * the HR app -- the HR operator taps "Return to HR" once they have the device
 * back.
 */
export default function ApplyDonePage() {
    const router = useRouter();

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
            <div className="space-y-1">
                <h1 className="text-xl font-semibold">Assessment complete</h1>
                <p className="text-sm text-muted-foreground">
                    Thank you. Please hand the device back to the HR staff.
                </p>
            </div>
            <Button onClick={() => router.push("/hrm/quiz-file-management/quiz-management")}>
                Return to HR
            </Button>
        </main>
    );
}
