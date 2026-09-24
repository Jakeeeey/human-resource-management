export type GovIdKind = "sss" | "tin" | "philhealth" | "pagibig";

interface GovIdFormat {
    label: string;
    groups: number[];
    example: string;
}

const GOV_ID_FORMATS: Record<GovIdKind, GovIdFormat> = {
    sss: { label: "SSS No.", groups: [2, 7, 1], example: "34-1234567-8" },
    tin: { label: "TIN", groups: [3, 3, 3, 3], example: "123-456-789-000" },
    philhealth: { label: "PhilHealth No.", groups: [2, 9, 1], example: "12-345678901-2" },
    pagibig: { label: "Pag-IBIG No.", groups: [4, 4, 4], example: "1234-1234-1234" },
};

function patternOf(groups: number[]): string {
    return groups.map((n) => "#".repeat(n)).join("-");
}

export function maskGovId(kind: GovIdKind, raw: string): string {
    const digits = raw.replace(/\D/g, "");
    const parts: string[] = [];
    let at = 0;
    for (const size of GOV_ID_FORMATS[kind].groups) {
        if (at >= digits.length) break;
        parts.push(digits.slice(at, at + size));
        at += size;
    }
    return parts.join("-");
}

export function govIdError(kind: GovIdKind, value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const { label, groups, example } = GOV_ID_FORMATS[kind];
    const pattern = new RegExp(`^${groups.map((n) => `\\d{${n}}`).join("-")}$`);
    if (pattern.test(trimmed)) return null;
    return `${label} must be ${patternOf(groups)} using digits only (example: ${example}). Leave it blank if you don't have one.`;
}

export function maskPhone(raw: string): string {
    const plus = raw.trimStart().startsWith("+");
    const digits = raw.replace(/\D/g, "");
    if (plus) return `+${digits}`.slice(0, 13);
    return digits.slice(0, 11);
}

const PHONE_PATTERN = /^(09\d{9}|\+639\d{9})$/;

export function phoneError(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return PHONE_PATTERN.test(trimmed)
        ? null
        : "Enter a valid Philippine mobile number: 11 digits starting with 09 (09171234567) or +639 followed by 9 digits (+639171234567).";
}

export function maskDecimal(raw: string): string {
    let seenPoint = false;
    let out = "";
    for (const ch of raw) {
        if (ch >= "0" && ch <= "9") out += ch;
        else if (ch === "." && !seenPoint) {
            seenPoint = true;
            out += ch;
        }
    }
    return out;
}

export function contactNumberError(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return /^\+?\d{7,13}$/.test(trimmed)
        ? null
        : "Enter the contact number using digits only, 7 to 13 digits (for example 09171234567 or 0281234567).";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /^\+?[\d\s\-()]+$/;

export function contactError(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (EMAIL_PATTERN.test(trimmed)) return null;
    if (PHONE_CHARS.test(trimmed)) {
        const digits = trimmed.replace(/\D/g, "").length;
        if (digits >= 7 && digits <= 15) return null;
    }
    return "Enter a valid email address (name@company.com) or phone number (for example 09171234567 or 02-8123-4567).";
}
