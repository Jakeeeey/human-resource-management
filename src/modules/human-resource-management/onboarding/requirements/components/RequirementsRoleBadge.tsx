import { Badge } from "@/components/ui/badge";

// RequirementsRoleBadge.tsx — one token-driven badge for every role-like catalog
// value (`track`, `owner_role`, `issuer`). Centralising the label + variant maps
// here fixes the systemic "all role badges render the same outline" defect once:
// each value now reads as a distinct treatment, and lowercase enum values (e.g.
// `hr`) are rendered with their correct display casing (`HR`).

export type RequirementRoleKind = "track" | "owner" | "issuer";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";

const ROLE_LABELS: Record<RequirementRoleKind, Record<string, string>> = {
  track: { company: "Company", department: "Department" },
  owner: {
    hr: "HR",
    department: "Department",
    hiree: "New hire",
    system: "System",
  },
  issuer: { IT: "IT", Admin: "Admin", Department: "Department" },
};

const ROLE_VARIANTS: Record<
  RequirementRoleKind,
  Record<string, BadgeVariant>
> = {
  track: { company: "default", department: "secondary" },
  owner: {
    hr: "default",
    department: "outline",
    hiree: "secondary",
    system: "outline",
  },
  issuer: { IT: "default", Admin: "secondary", Department: "outline" },
};

/**
 * Display label for one role value, e.g. `hiree` -> "New hire".
 * @param kind Role family the value belongs to.
 * @param value Raw stored value.
 * @returns The human label, falling back to the raw value.
 */
export function requirementRoleLabel(
  kind: RequirementRoleKind,
  value: string
): string {
  return ROLE_LABELS[kind][value] ?? value;
}

interface RequirementsRoleBadgeProps {
  kind: RequirementRoleKind;
  value: string;
  /** Optional context appended to the badge's accessible name. */
  context?: string;
}

/**
 * Renders a role value as a differentiated badge.
 * @param props Role kind, raw value, and optional accessible context.
 * @returns A badge whose label + variant are keyed by the role value.
 */
export function RequirementsRoleBadge({
  kind,
  value,
  context,
}: RequirementsRoleBadgeProps) {
  const label = requirementRoleLabel(kind, value);
  const variant = ROLE_VARIANTS[kind][value] ?? "outline";
  return (
    <Badge
      variant={variant}
      aria-label={context === undefined ? undefined : `${label} — ${context}`}
    >
      {label}
    </Badge>
  );
}
