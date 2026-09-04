"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function DoneContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const score = searchParams.get("score");
    const passedParam = searchParams.get("passed");
    const quizName = searchParams.get("quiz");
    const total = searchParams.get("total");
    const threshold = searchParams.get("threshold");

    const hasVerdict = passedParam === "true" || passedParam === "false";
    const passed = passedParam === "true";

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center p-6">
            <div className="mx-auto w-full max-w-md space-y-6 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                    {hasVerdict ? (
                        passed ? (
                            <CheckCircle2 className="h-12 w-12 text-green-600" />
                        ) : (
                            <XCircle className="h-12 w-12 text-destructive" />
                        )
                    ) : (
                        <CheckCircle2 className="h-14 w-14 text-green-600" />
                    )}
                    {hasVerdict && (
                        <Badge variant={passed ? "secondary" : "destructive"} className="px-4 py-1 text-base">
                            {passed ? "PASSED" : "FAILED"}
                        </Badge>
                    )}
                </div>
                <div className="rounded-lg border p-4 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Assessment</span>
                        <span className="font-medium">Complete</span>
                    </div>
                    {quizName && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Quiz</span>
                            <span className="font-medium">{quizName}</span>
                        </div>
                    )}
                    {score && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium tabular-nums">
                                {score}
                                {total ? ` / ${total}` : ""}
                            </span>
                        </div>
                    )}
                    {threshold && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Passing</span>
                            <span className="font-medium">{threshold}%</span>
                        </div>
                    )}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                    Thank you. Please hand the device back to the HR staff.
                </p>
                <Button
                    className="w-full"
                    onClick={() => router.push("/hrm/quiz-file-management/quiz-management")}
                >
                    Return to HR
                </Button>
            </div>
        </main>
    );
}

export default function ApplyDonePage() {
    return (
        <Suspense>
            <DoneContent />
        </Suspense>
    );
}
