"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Loader2,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  HireGateResponseSchema,
  type HireGateState,
} from "@/modules/human-resource-management/onboarding/hire/types/hire-gate.schema";

const GATE_URL = "/api/hrm/onboarding/hire-gate";

async function readGateBody(res: Response): Promise<{
  ok: boolean;
  gate: HireGateState | null;
  message: string | null;
}> {
  const body: unknown = await res.json().catch(() => null);
  const parsed = HireGateResponseSchema.safeParse(body);
  if (!res.ok || !parsed.success || !parsed.data.success) {
    const raw =
      typeof body === "object" && body !== null && "message" in body
        ? (body as { message?: unknown }).message
        : null;
    return {
      ok: false,
      gate: null,
      message:
        typeof raw === "string" && raw.trim() !== ""
          ? raw
          : "The onboarding gate request failed.",
    };
  }
  return { ok: true, gate: parsed.data.data?.gate ?? null, message: null };
}

export function HireGateCard({
  applicantId,
  onDone,
}: {
  applicantId: number;
  onDone?: () => void;
}) {
  const [gate, setGate] = useState<HireGateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyChoice, setBusyChoice] = useState<
    "employment" | "training" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${GATE_URL}?applicant_id=${applicantId}`, {
        cache: "no-store",
      });
      const result = await readGateBody(res);
      if (!result.ok || !result.gate) {
        setGate(null);
        setLoadError(result.message ?? "Could not load the onboarding gate.");
        return;
      }
      setGate(result.gate);
      if (
        result.gate.applicantStatus === "for_training" &&
        result.gate.needsTrainingChoice
      ) {
        setShowPicker(true);
      }
    } catch {
      setGate(null);
      setLoadError("Could not load the onboarding gate. Retry shortly.");
    } finally {
      setLoading(false);
    }
  }, [applicantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runChoice = useCallback(
    async (choice: "employment" | "training", trainingTemplateId?: number) => {
      if (choice === "training" && trainingTemplateId === undefined) {
        setBusyChoice(choice);
      } else if (choice === "employment") {
        setBusyChoice(choice);
      } else {
        setConfirming(true);
      }
      setActionError(null);
      setNotice(null);
      try {
        const res = await fetch(GATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicant_id: applicantId,
            choice,
            ...(trainingTemplateId !== undefined
              ? { training_template_id: trainingTemplateId }
              : {}),
          }),
        });
        const result = await readGateBody(res);
        if (!result.ok || !result.gate) {
          setActionError(result.message ?? "Could not record this decision.");
          return;
        }
        setGate(result.gate);
        if (choice === "employment") {
          setNotice(
            "The employee account is created and training is waived — this hire is ready."
          );
          onDone?.();
        } else if (trainingTemplateId !== undefined) {
          setNotice("Training assigned — only the chosen template applies.");
          onDone?.();
        } else {
          setShowPicker(true);
          setNotice("The employee account is created — pick a training.");
        }
      } catch {
        setActionError("The onboarding gate request failed. Retry shortly.");
      } finally {
        setBusyChoice(null);
        setConfirming(false);
      }
    },
    [applicantId, onDone]
  );

  if (loading) {
    return (
      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </CardContent>
      </Card>
    );
  }

  if (!gate) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Could not load the onboarding gate</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{loadError ?? "Retry shortly."}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const choosing = busyChoice !== null || confirming;
  const workspaceHref =
    gate.userId !== null ? `/hrm/onboarding/${gate.userId}` : null;

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="truncate" title={gate.applicantName}>
          {gate.applicantName}
        </CardTitle>
        <CardDescription>
          {gate.applicantStatus === "signing_complete"
            ? "Signing is complete and no account exists yet — decide how this hire enters onboarding."
            : gate.applicantStatus === "for_training"
              ? "Account created for training — choose which department training applies."
              : "This applicant already completed the onboarding gate."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Could not record this decision</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        {notice ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 break-words">
            {notice}
          </p>
        ) : null}

        {gate.applicantStatus === "signing_complete" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={choosing}
              onClick={() => void runChoice("training")}
              aria-label="Send applicant for training"
            >
              {busyChoice === "training" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GraduationCap className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {busyChoice === "training" ? "Creating account…" : "For Training"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={choosing}
              onClick={() => void runChoice("employment")}
              aria-label="Hire applicant for employment"
            >
              {busyChoice === "employment" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Briefcase className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {busyChoice === "employment"
                ? "Creating account…"
                : "For Employment"}
            </Button>
          </div>
        ) : null}

        {gate.applicantStatus === "for_training" &&
        (showPicker || gate.needsTrainingChoice) ? (
          <div className="space-y-3">
            {gate.templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active training template applies to this hire&apos;s
                department yet — add one in the training catalog, then retry.
              </p>
            ) : (
              <>
                <ul className="grid gap-2">
                  {gate.templates.map((template) => {
                    const active = selectedTemplate === template.id;
                    return (
                      <li key={template.id}>
                        <button
                          type="button"
                          aria-pressed={active}
                          disabled={choosing}
                          onClick={() => setSelectedTemplate(template.id)}
                          className={cn(
                            "w-full rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                            active
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className="truncate text-sm font-medium"
                              title={template.title}
                            >
                              {template.title}
                            </span>
                            <span className="inline-flex shrink-0 items-center rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-foreground">
                              {template.global ? "Global" : "Department"}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {template.itemCount} item
                            {template.itemCount === 1 ? "" : "s"} ·{" "}
                            {template.requiredItemCount} required
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={selectedTemplate === null || choosing}
                    onClick={() =>
                      selectedTemplate !== null &&
                      void runChoice("training", selectedTemplate)
                    }
                  >
                    {confirming ? (
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                    )}
                    {confirming ? "Assigning…" : "Assign selected training"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={choosing}
                    onClick={() => void load()}
                  >
                    Refresh templates
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {workspaceHref ? (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href={workspaceHref}>Open workspace</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
