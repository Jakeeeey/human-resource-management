// Soft (warn-don't-block) format hints -- architecture sec 4 item 21. These
// never wire into react-hook-form's error state and never prevent submit;
// they're purely an inline nudge rendered via <SoftWarning>.

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

/** Returns a hint message if `value` is non-empty and doesn't match, else null. */
export function checkFormat(kind: keyof typeof CHECKS, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const check = CHECKS[kind];
    return check.pattern.test(trimmed) ? null : check.hint;
}
