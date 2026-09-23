import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

export const PROBATION_STATUS_LABELS: Record<string, string> = {
  probationary: "Probationary",
  pip_open: "PIP in progress",
  recommendation_issued: "For regularization",
  regular: "Regular",
  terminated: "Separated",
};

export const PROBATION_STATUS_TONES: Record<string, StatusTone> = {
  probationary: "info",
  pip_open: "warning",
  recommendation_issued: "info",
  regular: "success",
  terminated: "destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <StatusBadge tone={PROBATION_STATUS_TONES[status] ?? "neutral"}>
      {PROBATION_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  );
}
