import type { HireCompletionStep } from "../types/hire.schema";

export function toHireStepKebabName(functionName: string): string {
  const withoutSuffix = functionName.endsWith("Step")
    ? functionName.slice(0, -"Step".length)
    : functionName;
  return withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function matchesHireSkipStep(
  step: HireCompletionStep,
  skipEntry: string
): boolean {
  const functionName = step.name || "post-hire-step";
  if (skipEntry === functionName) return true;
  return skipEntry === toHireStepKebabName(functionName);
}

export function isHireStepSkipped(
  step: HireCompletionStep,
  skipSteps: readonly string[] | undefined | null
): boolean {
  if (!skipSteps || skipSteps.length === 0) return false;
  return skipSteps.some((entry) => matchesHireSkipStep(step, entry));
}
