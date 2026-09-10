"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrainingAssignments } from "../hooks/useTrainingAssignments";
import { useTrainingAssignmentFetch } from "../providers/trainingAssignmentProvider";

// TrainingOverviewTab.tsx — HR overview per hire (Todo 12).
//
// Groups the hire's assignments into assigned / in-progress / completed
// (the adapter lifecycle). Overdue is the adapter's DERIVED flag
// (`isAssignmentOverdue` — never a stored state). HR can assign a quiz
// from here (POST collection route); taking/grading stays in the hiree
// view + assignment-scoped routes.

export function TrainingOverviewTab({
  userId,
}: {
  userId?: number;
}): React.ReactNode {
  const { assigned, inProgress, completed, overdueIds, isLoading, isError } =
    useTrainingAssignments();
  const { createAssignment } = useTrainingAssignmentFetch();
  const [quizId, setQuizId] = useState("");
  const [due, setDue] = useState("");
  const [formError, setFormError] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function handleAssign(): Promise<void> {
    setFormError("");
    const parsedQuiz = Number(quizId);
    if (!Number.isInteger(parsedQuiz) || parsedQuiz <= 0) {
      setFormError("Enter a valid quiz id.");
      return;
    }
    if (userId === undefined) {
      setFormError("An employee is required to assign training.");
      return;
    }
    setAssigning(true);
    try {
      await createAssignment({
        user_id: userId,
        quiz_id: parsedQuiz,
        due: due.trim() === "" ? null : due.trim(),
      });
      setQuizId("");
      setDue("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Assign failed.");
    } finally {
      setAssigning(false);
    }
  }

  function renderRows(
    rows: typeof assigned,
    empty: string
  ): React.ReactNode {
    if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 pr-4">Assignment</th>
              <th className="py-2 pr-4">Quiz</th>
              <th className="py-2 pr-4">Due</th>
              <th className="py-2 pr-4">Overdue</th>
              <th className="py-2">Result ref</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2 pr-4">#{a.id}</td>
                <td className="py-2 pr-4">Quiz #{a.quiz_id}</td>
                <td className="py-2 pr-4">{a.due ?? "No deadline"}</td>
                <td className="py-2 pr-4">{overdueIds.has(a.id) ? "Overdue" : "—"}</td>
                <td className="py-2">{a.completed_ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-6 md:p-10">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold">Training Overview</h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          Assigned, in-progress, and completed trainings for this hire.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="space-y-1">
          <label htmlFor="tr-quiz-id" className="text-sm font-medium">Quiz id</label>
          <Input
            id="tr-quiz-id"
            value={quizId}
            onChange={(e) => setQuizId(e.target.value)}
            placeholder="e.g. 14"
            className="w-full sm:w-40"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="tr-due" className="text-sm font-medium">Due (optional)</label>
          <Input
            id="tr-due"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="YYYY-MM-DD HH:mm:ss"
            className="w-full sm:w-56"
          />
        </div>
        <Button className="w-full sm:w-auto" disabled={assigning} onClick={() => void handleAssign()}>
          {assigning ? "Assigning..." : "Assign quiz"}
        </Button>
      </div>
      {formError !== "" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t assign</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2 py-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load overview</AlertTitle>
          <AlertDescription>Please refresh and try again.</AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Assigned ({assigned.length})</h2>
            {renderRows(assigned, "Nothing assigned.")}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">In progress ({inProgress.length})</h2>
            {renderRows(inProgress, "Nothing in progress.")}
          </section>
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Completed ({completed.length})</h2>
            {renderRows(completed, "Nothing completed yet.")}
          </section>
        </>
      )}
    </div>
  );
}
