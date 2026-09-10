"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type {
  AnswersByQuestionId,
  StartQuizResponse,
  TakingQuestion,
} from "@/modules/human-resource-management/quiz-file-management/quiz-taking/types";
import type { TrainingActor } from "../types/training-taking.schema";
import { buildSubmitPayloads } from "../trainingAssignmentAdapter";
import {
  useTrainingAssignmentFetch,
  type StartAttemptResult,
  type SubmitAttemptResult,
} from "../providers/trainingAssignmentProvider";

// TrainingTakingView.tsx — hiree taking view (Todo 12).
//
// Flow: assigned list -> start -> in-progress (resumable) -> submit ->
// completed with score/pass. Built ONLY on the Todo 4 adapter
// (`buildSubmitPayloads` for answer shaping) + the assignment-scoped
// start/submit routes (which reuse the untouched quiz draw/grade engine).
// No grading math lives here — the done screen shows ONLY the display-safe
// scalars the submit route reads off the real `GradeResult` (same rule as
// the quiz taking-module done screen: score, pass flag, totals — never
// answers or answer keys).
//
// UX mirrors `QuizTakingModule`: progress dots, countdown, Back/Next,
// beforeunload guard, leave-confirm dialog, blocked + submitting states.

type Step = "list" | "blocked" | "in-progress" | "submitting" | "done";

const CHOICE_TYPES = new Set(["true_false", "multiple_choice"]);

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TakingQuestionCard({
  question,
  index,
  total,
  timeRemainingSeconds,
  value,
  onChange,
}: {
  question: TakingQuestion;
  index: number;
  total: number;
  timeRemainingSeconds: number | null;
  value: string[];
  onChange: (next: string[]) => void;
}): React.ReactNode {
  const isChoiceType = CHOICE_TYPES.has(question.question_type);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-muted-foreground">
            Question {index + 1} of {total}
          </span>
          {timeRemainingSeconds != null && (
            <span className="text-sm font-medium tabular-nums">
              {formatTime(timeRemainingSeconds)}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <p className="text-lg font-medium break-words">{question.question_text}</p>
        {isChoiceType ? (
          <RadioGroup
            value={value[0] ?? ""}
            onValueChange={(v) => onChange([v])}
            className="space-y-2"
          >
            {question.choices.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <RadioGroupItem value={String(c.id)} id={`tr-q-${question.id}-c-${c.id}`} />
                <Label htmlFor={`tr-q-${question.id}-c-${c.id}`} className="min-w-0 flex-1 break-words">
                  {c.option_text ?? "[image option]"}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: question.blank_count || 1 }, (_, i) => (
              <Input
                key={i}
                value={value[i] ?? ""}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                placeholder={`Answer ${i + 1}`}
                className="w-full"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TrainingTakingView({
  actor,
}: {
  actor: TrainingActor;
}): React.ReactNode {
  const { assignments, isLoading, isError, startAttempt, submitAttempt } =
    useTrainingAssignmentFetch();

  const [step, setStep] = useState<Step>("list");
  const [blockedMessage, setBlockedMessage] = useState("");
  const [draw, setDraw] = useState<StartAttemptResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersByQuestionId>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [abandonNote, setAbandonNote] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);
  const [pendingNav, setPendingNav] = useState<boolean>(false);
  const bypassRef = useRef(false);

  const activeQuestions: StartQuizResponse["questions"] = useMemo(
    () => draw?.questions ?? [],
    [draw]
  );

  const handleStart = useCallback(
    async (assignmentId: number) => {
      setBlockedMessage("");
      setAbandonNote(null);
      try {
        const started = await startAttempt(assignmentId, { actor });
        setDraw(started);
        setAnswers({});
        setCurrentIndex(0);
        setStartedAt(new Date().toISOString());
        setSecondsRemaining(
          started.quiz.time_limit_enabled && started.quiz.time_limit_minutes
            ? started.quiz.time_limit_minutes * 60
            : null
        );
        setStep("in-progress");
      } catch (err) {
        setBlockedMessage(err instanceof Error ? err.message : "Could not start this training.");
        setStep("blocked");
      }
    },
    [actor, startAttempt]
  );

  const handleSubmit = useCallback(async () => {
    if (isSubmittingRef.current || !draw) return;
    isSubmittingRef.current = true;
    setStep("submitting");
    try {
      const payload = buildSubmitPayloads(activeQuestions, answers);
      const outcome = await submitAttempt(draw.assignment.id, {
        actor,
        answers: payload,
        started_at: startedAt,
      });
      if ("abandoned" in outcome) {
        setAbandonNote(outcome.reason);
        setStep("list");
        return;
      }
      setResult(outcome as SubmitAttemptResult);
      setStep("done");
    } catch (err) {
      isSubmittingRef.current = false;
      setBlockedMessage(err instanceof Error ? err.message : "Submit failed. Please try again.");
      setStep("blocked");
    }
  }, [draw, activeQuestions, answers, actor, startedAt, submitAttempt]);

  const handleAbandon = useCallback(async () => {
    if (isSubmittingRef.current || !draw) return;
    isSubmittingRef.current = true;
    setStep("submitting");
    try {
      const outcome = await submitAttempt(draw.assignment.id, {
        actor,
        abandon: true,
        reason: "Hiree ended the attempt before submitting",
      });
      if ("abandoned" in outcome) {
        setAbandonNote(outcome.reason);
      }
      setDraw(null);
      setStep("list");
    } catch (err) {
      setBlockedMessage(err instanceof Error ? err.message : "Could not end this attempt.");
      setStep("blocked");
    } finally {
      isSubmittingRef.current = false;
    }
  }, [draw, actor, submitAttempt]);

  useEffect(() => {
    if (step !== "in-progress" || secondsRemaining == null) return;
    if (secondsRemaining <= 0) {
      void handleSubmit();
      return;
    }
    const t = setTimeout(() => setSecondsRemaining((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [step, secondsRemaining, handleSubmit]);

  useEffect(() => {
    if (step !== "in-progress") return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [step]);

  if (isLoading && step === "list") {
    return <div className="text-sm text-muted-foreground">Loading your training...</div>;
  }

  if (step === "blocked") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8 p-2 sm:p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Can&apos;t Continue Training</AlertTitle>
          <AlertDescription>{blockedMessage}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => {
            isSubmittingRef.current = false;
            setStep("list");
          }}
        >
          Back to my training
        </Button>
      </div>
    );
  }

  if (step === "submitting") {
    return <div className="text-sm text-muted-foreground">Submitting your answers...</div>;
  }

  if (step === "done" && result) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-8 p-2 sm:p-6">
        <Alert variant={result.passed ? "default" : "destructive"}>
          <AlertTitle>{result.passed ? "Training passed" : "Training not passed"}</AlertTitle>
          <AlertDescription>
            Score {result.score} ({result.percentage_score}%) — attempt #{result.attempt_id}.
            {!result.passed && " You can re-take this training from your list."}
          </AlertDescription>
        </Alert>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            isSubmittingRef.current = false;
            setDraw(null);
            setResult(null);
            setStep("list");
          }}
        >
          Back to my training
        </Button>
      </div>
    );
  }

  if (step === "in-progress" && draw) {
    const question = activeQuestions[currentIndex];
    if (!question) return null;
    const isLast = currentIndex === activeQuestions.length - 1;
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4 p-2 sm:p-6">
        {draw.resumed && (
          <Alert>
            <AlertTitle>Attempt resumed</AlertTitle>
            <AlertDescription>
              Your in-progress attempt is still open — continue where you left off.
            </AlertDescription>
          </Alert>
        )}
        <TakingQuestionCard
          question={question}
          index={currentIndex}
          total={activeQuestions.length}
          timeRemainingSeconds={secondsRemaining}
          value={answers[question.id] || []}
          onChange={(next) => setAnswers((prev) => ({ ...prev, [question.id]: next }))}
        />
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          >
            Back
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setPendingNav(true)}>
              End attempt
            </Button>
            {isLast ? (
              <Button className="w-full sm:w-auto" onClick={() => void handleSubmit()}>Submit</Button>
            ) : (
              <Button className="w-full sm:w-auto" onClick={() => setCurrentIndex((i) => i + 1)}>Next</Button>
            )}
          </div>
        </div>
        <AlertDialog
          open={pendingNav}
          onOpenChange={(open) => {
            if (!open) setPendingNav(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>End this training attempt?</AlertDialogTitle>
              <AlertDialogDescription>
                The attempt stays in progress with this reason and you can re-take it. Your
                answers so far won&apos;t be graded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingNav(false)}>Keep taking</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setPendingNav(false);
                  bypassRef.current = true;
                  void handleAbandon();
                }}
              >
                End attempt
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 sm:p-6 md:p-10">
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold">My Training</h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          Start an assigned quiz, resume an in-progress attempt, or review completed trainings.
        </p>
      </div>
      {abandonNote && (
        <Alert>
          <AlertTitle>Attempt ended</AlertTitle>
          <AlertDescription>{abandonNote} — re-take it below whenever ready.</AlertDescription>
        </Alert>
      )}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load training</AlertTitle>
          <AlertDescription>Please refresh and try again.</AlertDescription>
        </Alert>
      )}
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No training assigned yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4">Quiz</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Due</th>
                <th className="py-2 pr-4">Result ref</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2 pr-4 break-words">Quiz #{a.quiz_id}</td>
                  <td className="py-2 pr-4">{a.status.replace("_", " ")}</td>
                  <td className="py-2 pr-4">{a.due ?? "No deadline"}</td>
                  <td className="py-2 pr-4">{a.completed_ref ?? "—"}</td>
                  <td className="py-2">
                    {a.status === "completed" ? (
                      <span className="text-muted-foreground">Completed</span>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => void handleStart(a.id)}
                      >
                        {a.status === "in_progress" ? "Resume" : "Start"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
