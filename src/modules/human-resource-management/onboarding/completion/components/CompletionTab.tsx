"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readJson, toCheckState, type CheckState } from "../completionTabData";

// CompletionTab.tsx — workspace Completion section keyed to the EMPLOYEE
// (todo 22). Re-checks the employee's task set through the completion GET and
// drives the POST that reports completion. The employee is the canonical hire
// from the route, so there is no picker and no roster fetch.

export function CompletionTab({ userId }: { userId: number }) {
  const [check, setCheck] = useState<CheckState | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runCheck = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/hrm/onboarding/completion?user_id=${id}`, {
        cache: "no-store",
      });
      const body = await readJson(res);
      const state = toCheckState(id, body);
      if (!res.ok || body.success !== true || !state) {
        setCheck(null);
        setError(
          typeof body.message === "string"
            ? body.message
            : "Completion check failed."
        );
        return;
      }
      setCheck(state);
    } catch {
      setCheck(null);
      setError("Completion check failed. Retry shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runCheck(userId);
  }, [userId, runCheck]);

  const runComplete = useCallback(async () => {
    setCompleting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/hrm/onboarding/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const body = await readJson(res);
      const state = toCheckState(userId, body);
      if (!res.ok || body.success !== true) {
        if (state) setCheck(state);
        setError(
          typeof body.message === "string"
            ? body.message
            : "Completion blocked — see the missing tasks."
        );
        return;
      }
      setNotice("Onboarding complete — every required task is done.");
      await runCheck(userId);
    } catch {
      setError("Completion request failed. Retry shortly.");
    } finally {
      setCompleting(false);
    }
  }, [userId, runCheck]);

  const requiredDone = check
    ? check.checklist.filter((item) => item.required && item.done).length
    : 0;
  const requiredTotal = check
    ? check.checklist.filter((item) => item.required).length
    : 0;

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="max-w-[300px] truncate" title="Completion">
          Completion
        </CardTitle>
        <CardDescription>
          Employee task-set completion — every required onboarding task done.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Employee #{userId}</p>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void runCheck(userId)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Re-check"
            )}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive break-words">{error}</p>
        )}
        {notice && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 break-words">
            {notice}
          </p>
        )}

        {check && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Required tasks: {requiredDone}/{requiredTotal} done
              {check.missing.length > 0
                ? ` · ${check.missing.length} still open`
                : ""}
            </p>
            <div className="overflow-x-auto">
              <ul className="min-w-[320px] divide-y divide-border rounded-md border border-border">
                {check.checklist.map((item) => (
                  <li key={item.key} className="flex items-start gap-2 px-3 py-2">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={item.label}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={!check.ready || completing}
              onClick={() => void runComplete()}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : check.ready ? (
                "Verify completion"
              ) : (
                "Complete all required tasks first"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
