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

const STATUS_TONE_BADGE_CLASS: Record<StatusTone, string> = {
  neutral: "border-transparent bg-muted text-foreground",
  success:
    "border-transparent bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]",
  warning:
    "border-transparent bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]",
  info: "border-transparent bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]",
  destructive: "border-transparent bg-destructive/10 text-destructive",
};

export function statusToneBadgeClass(tone: StatusTone): string {
  return STATUS_TONE_BADGE_CLASS[tone];
}

export function StatusPill({ status }: { status: string }) {
  const tone = PROBATION_STATUS_TONES[status] ?? "neutral";
  return (
    <StatusBadge tone={tone} className={STATUS_TONE_BADGE_CLASS[tone]}>
      {PROBATION_STATUS_LABELS[status] ?? status}
    </StatusBadge>
  );
}
