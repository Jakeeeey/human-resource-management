interface FormatCheck {
    pattern: RegExp;
    hint: string;
}

const CHECKS: Record<string, FormatCheck> = {
    sss: { pattern: /^\d{2}-\d{7}-\d$/, hint: "Expected format: ##-#######-#" },
    tin: { pattern: /^\d{3}-\d{3}-\d{3}-\d{3}$/, hint: "Expected format: ###-###-###-###" },
    philhealth: { pattern: /^\d{2}-\d{9}-\d$/, hint: "Expected format: ##-#########-#" },
    pagibig: { pattern: /^\d{4}-\d{4}-\d{4}$/, hint: "Expected format: ####-####-####" },
    phone: { pattern: /^(09\d{9}|\+639\d{9})$/, hint: "Expected format: 09######### or +639#########" },
    email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, hint: "Doesn't look like a valid email address" },
};

export function checkFormat(kind: keyof typeof CHECKS, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const check = CHECKS[kind];
    return check.pattern.test(trimmed) ? null : check.hint;
}

export function computeAgeYears(iso: string): number | null {
    const trimmed = iso.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
    return age >= 0 && age < 130 ? age : null;
}

/**
 * Hard eligibility check for the applicant birthdate.
 * Returns an error message when the value must block submission,
 * null when it passes (empty is handled by the Required rule).
 */
export function checkBirthdate(iso: string): string | null {
    const trimmed = iso.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "Enter a valid birthdate.";
    if (d.getTime() > Date.now()) return "Birthdate can't be in the future.";
    const age = computeAgeYears(trimmed);
    if (age == null) return "Enter a valid birthdate.";
    if (age < 18) return "Applicants must be at least 18 years old.";
    return null;
}

/** Soft hint for a birthdate that parses but looks like a typo (non-blocking). */
export function checkUnlikelyAge(iso: string): string | null {
    const age = computeAgeYears(iso);
    if (age == null) return null;
    return age > 90 ? `Age ${age} looks unlikely — please double-check the birth year.` : null;
}

/** Soft hint for implausible height entries (non-blocking). */
export function checkHeightCm(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return "Enter a height above zero.";
    return n < 100 || n > 250 ? "That height looks unlikely — please double-check (cm)." : null;
}

/** Soft hint for implausible weight entries (non-blocking). */
export function checkWeightKg(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return "Enter a weight above zero.";
    return n < 25 || n > 400 ? "That weight looks unlikely — please double-check (kg)." : null;
}

/**
 * Hard check that an end date does not precede its start date.
 * Either side empty means ongoing/unknown — no error.
 */
export function checkDateOrder(from: string, to: string): string | null {
    const f = from.trim();
    const t = to.trim();
    if (!f || !t) return null;
    const fromTime = new Date(f).getTime();
    const toTime = new Date(t).getTime();
    if (Number.isNaN(fromTime) || Number.isNaN(toTime)) return "Enter valid dates.";
    return toTime < fromTime ? "End date can't be before the start date." : null;
}

/** Hard check that a completed/past event date is not in the future. */
export function checkPastDate(iso: string, label: string): string | null {
    const trimmed = iso.trim();
    if (!trimmed) return null;
    const time = new Date(trimmed).getTime();
    if (Number.isNaN(time)) return `Enter a valid ${label}.`;
    return time > Date.now() ? `${label} can't be in the future.` : null;
}
