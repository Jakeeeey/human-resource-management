"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Building2, CheckCircle2, Users } from "lucide-react";

import { useOrientation } from "../hooks/useOrientation";
import type { OrientationTopic } from "../types/orientation.schema";

// OrientationTab.tsx — workspace Orientation section, keyed to the EMPLOYEE
// (`user_id`) since todo 20. Two tracks per pdf §7: company (HR-owned) +
// department (department-owned). Titles come from the topic store (seed data,
// admin-editable) — never inline literals. Check-offs complete the employee's
// orientation `onboarding_task` rows; the employee is the canonical hire from
// the route, so there is no picker and no client role selector.

function TrackCard({
  title,
  description,
  icon,
  topics,
  checkedIds,
  ownerLabel,
  checkingId,
  onCheck,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  topics: OrientationTopic[];
  checkedIds: Set<string>;
  ownerLabel: string;
  checkingId: string | null;
  onCheck: (topicId: string) => void;
}) {
  const requiredDone = topics.filter(
    (t) => t.required && checkedIds.has(t.id)
  ).length;
  const requiredTotal = topics.filter((t) => t.required).length;
  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <CardTitle className="max-w-[300px] truncate" title={title}>
              {title}
            </CardTitle>
          </div>
          <Badge variant="outline" className="shrink-0">
            {ownerLabel}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
        <p className="text-xs text-muted-foreground">
          {requiredDone}/{requiredTotal} required checked
        </p>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center h-24 flex items-center justify-center">
            No topics found.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {topics.map((topic) => {
              const checked = checkedIds.has(topic.id);
              return (
                <li key={topic.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span
                      className="block max-w-[300px] truncate text-sm font-medium"
                      title={topic.title}
                    >
                      {topic.title}
                    </span>
                    {!topic.required && (
                      <span className="text-xs text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </span>
                  {checked ? (
                    <Badge variant="secondary" className="shrink-0">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Done
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={checkingId === topic.id}
                      onClick={() => onCheck(topic.id)}
                      className="shrink-0"
                      aria-label={`Check off ${topic.title}`}
                      title={`Owned by ${ownerLabel}`}
                    >
                      Check off
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function OrientationTab({ userId }: { userId: number }) {
  const {
    selectedEmployee,
    companyTopics,
    departmentTopics,
    checkedIds,
    done,
    isLoading,
    isError,
    error,
    rosterError,
    actionError,
    checkingId,
    checkTopic,
  } = useOrientation(userId);

  const employeeLabel = selectedEmployee?.name ?? `Employee #${userId}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {done
            ? `${employeeLabel}: orientation complete`
            : `${employeeLabel}: orientation in progress`}
        </p>
      </div>

      {(isError || actionError || rosterError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Orientation action failed</AlertTitle>
          <AlertDescription>
            {actionError ?? error?.message ?? rosterError?.message ?? "Fetch failed"}
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrackCard
            title="Company Orientation"
            description="HR-owned track from pdf §7."
            icon={<Building2 className="h-4 w-4 text-muted-foreground shrink-0" />}
            topics={companyTopics}
            checkedIds={checkedIds}
            ownerLabel="HR"
            checkingId={checkingId}
            onCheck={(id) => void checkTopic(id)}
          />
          <TrackCard
            title="Department Orientation"
            description="Department-owned track; HR checks it off as the department proxy."
            icon={<Users className="h-4 w-4 text-muted-foreground shrink-0" />}
            topics={departmentTopics}
            checkedIds={checkedIds}
            ownerLabel="Department"
            checkingId={checkingId}
            onCheck={(id) => void checkTopic(id)}
          />
        </div>
      )}
    </div>
  );
}
