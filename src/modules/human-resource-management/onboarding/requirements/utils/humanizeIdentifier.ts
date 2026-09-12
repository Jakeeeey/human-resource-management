// humanizeIdentifier.ts — display helper for the immutable catalog keys.
//
// The stored natural keys are machine identifiers: usually snake_case
// (`valid_id`, `company_id`, `training_policy_ack`) but also kebab-case
// (`company-background`) or space-separated. HR-facing tables should not surface
// raw database vocabulary, so the display layer splits on hyphen, underscore, or
// whitespace and converts each part to a spaced, cased label while the raw value
// stays available via each cell's `title` tooltip.

const ACRONYMS: Record<string, string> = {
  id: "ID",
  hr: "HR",
  it: "IT",
  kpi: "KPI",
  kra: "KRA",
  nbi: "NBI",
  tor: "TOR",
  coe: "COE",
  ids: "IDs",
  psa: "PSA",
  dept: "Department",
};

/**
 * Converts a machine identifier into a spaced, humanised label. Hyphens,
 * underscores, and whitespace all act as word boundaries.
 * @param value Raw machine identifier (e.g. `system_access`, `company-background`).
 * @returns The humanised label (e.g. `System Access`, `Company Background`);
 * empty input is returned unchanged so an unset key does not render a stray label.
 */
export function humanizeIdentifier(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => {
      const lower = part.toLowerCase();
      if (ACRONYMS[lower] !== undefined) return ACRONYMS[lower];
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
