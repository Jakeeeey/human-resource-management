"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
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

    const scoreNum = score != null && score !== "" ? Number(score) : null;
    const totalNum = total != null && total !== "" ? Number(total) : null;
    const percentage =
        scoreNum != null && totalNum != null && totalNum > 0
            ? Math.round((scoreNum / totalNum) * 10000) / 100
            : null;

    // Without a recorded verdict there is no result to celebrate — show a
    // neutral, truthful state instead of the green "Assessment Complete" splash.
    if (!hasVerdict) {
        return (
            <main className="flex min-h-dvh flex-col items-center justify-center p-6">
                <div className="mx-auto w-full max-w-md space-y-6 py-8">
                    <div className="flex flex-col items-center gap-2 text-center">
                        <AlertCircle className="h-12 w-12 text-amber-600" />
                        <h1 className="text-lg font-semibold">Assessment not completed</h1>
                    </div>
                    <div className="space-y-2 rounded-lg border p-4 text-sm">
                        <p className="text-muted-foreground">
                            No result was recorded for this assessment, so there is nothing to
                            show here. Please see the HR staff for assistance.
                        </p>
                        {quizName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Quiz</span>
                                <span className="font-medium">{quizName}</span>
                            </div>
                        )}
                    </div>
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

    return (
        <main className="flex min-h-dvh flex-col items-center justify-center p-6">
            <div className="mx-auto w-full max-w-md space-y-6 py-8">
                <div className="flex flex-col items-center gap-2 text-center">
                    {passed ? (
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                    ) : (
                        <XCircle className="h-12 w-12 text-destructive" />
                    )}
                    <Badge
                        variant={passed ? "secondary" : "destructive"}
                        className="px-4 py-1 text-base"
                    >
                        {passed ? "PASSED" : "FAILED"}
                    </Badge>
                </div>
                <div className="space-y-2 rounded-lg border p-4 text-sm">
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
                    {scoreNum != null && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-medium tabular-nums">
                                {percentage != null ? `${percentage}%` : score}
                                {total ? ` · ${score} of ${total} correct` : ""}
                            </span>
                        </div>
                    )}
                    {threshold && (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Passing threshold</span>
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
