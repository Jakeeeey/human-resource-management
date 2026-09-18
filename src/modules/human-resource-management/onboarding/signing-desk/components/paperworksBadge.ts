import type { Paperworks } from "../../signing/types/contracts";

// paperworksBadge.ts — shared display derivation for the signing desk's
// Paperworks badge (used by both the lg+ table and the <lg cards). It reuses
// the tint palette the retired Envelope column used: complete -> filled
// (default), in-progress -> amber outline, nothing signed -> muted (secondary).
//
// The state comes from the paperworks rollup `required_count` / `signed_count`
// (all required templates means complete ⇔ signed_count === required_count)
// with a defensive fallback to the rollup status. Counts that are missing,
// non-finite, or zero never render as `NaN` / `undefined` / `0/0`, and a raw
// DB status string is never surfaced.

const PARTIAL_TINT =
  "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";

export interface PaperworksBadge {
  label: string;
  variant: "default" | "secondary" | "outline";
  className?: string;
}

function asCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

export function paperworksBadge(
  paperworks: Paperworks | null | undefined
): PaperworksBadge {
  const status = paperworks?.status;
  const required = asCount(paperworks?.required_count);
  const signed = asCount(paperworks?.signed_count);

  const isComplete =
    status === "complete" ||
    (required !== null && required > 0 && signed !== null && signed >= required);

  if (isComplete) {
    return { label: "Complete", variant: "default" };
  }

  const hasProgress =
    status === "partial" || (signed !== null && signed > 0);

  if (hasProgress) {
    const showCount = required !== null && required > 0 && signed !== null;
    return {
      label: showCount ? `Partial (${signed}/${required})` : "Partial",
      variant: "outline",
      className: PARTIAL_TINT,
    };
  }

  return { label: "Unsigned", variant: "secondary" };
}
