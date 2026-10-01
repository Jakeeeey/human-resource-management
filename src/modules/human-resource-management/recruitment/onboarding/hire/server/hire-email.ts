// hire-email.ts — pure helpers that derive the generated company login
// address for a newly hired employee (post-hire orchestrator, todo 16).
//
// The employee's REAL email is the identity (stored in `user.personal_email`);
// the account's login address is synthesized as `first_last@companydomain`
// where the domain comes from the offer's company (`job_offer.company_id` ->
// `company_list.company_email`). Nothing here touches Directus or Spring —
// these are deterministic string transforms so they can be reasoned about and
// reused by the idempotent hire-user resolution.

const LOCAL_PART_MAX_LENGTH = 64;

const NAME_SUFFIXES = ["jr", "sr", "ii", "iii", "iv", "v"] as const;

const NON_ASCII_LETTER_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/ß/g, "ss"],
  [/ø/g, "o"],
  [/đ/g, "d"],
  [/ł/g, "l"],
  [/æ/g, "ae"],
  [/œ/g, "oe"],
];

export function transliterateToAscii(value: string): string {
  let result = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [pattern, replacement] of NON_ASCII_LETTER_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function normalizeNamePart(value: string): string {
  return transliterateToAscii(value).replace(/[^a-z0-9]/g, "");
}

export function stripNameSuffixes(lastName: string): string {
  const tokens = lastName.trim().split(/[\s,]+/).filter(Boolean);
  while (tokens.length > 0) {
    const token = tokens[tokens.length - 1].toLowerCase().replace(/\./g, "");
    if (!(NAME_SUFFIXES as readonly string[]).includes(token)) break;
    tokens.pop();
  }
  return tokens.join(" ");
}

export function buildLoginLocalPart(firstName: string, lastName: string): string {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(stripNameSuffixes(lastName));
  if (first.length > 0 && last.length > 0) return `${first}_${last}`;
  return first.length > 0 ? first : last;
}

export function extractEmailDomain(
  companyEmail: string | null | undefined
): string | null {
  if (typeof companyEmail !== "string") return null;
  const at = companyEmail.lastIndexOf("@");
  if (at < 0) return null;
  const domain = companyEmail.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

export function buildLoginEmail(
  localPart: string,
  domain: string,
  suffix?: string
): string {
  const suffixText = suffix ?? "";
  const maxBase = Math.max(0, LOCAL_PART_MAX_LENGTH - suffixText.length);
  const base = localPart.slice(0, maxBase);
  return `${base}${suffixText}@${domain}`;
}

const SYNTHETIC_HIRE_IDENTITY_PATTERN = /^applicant-\d+@no-email\.invalid$/;

/**
 * Reports whether a hire identity is the synthetic applicant-scoped fallback
 * (see `placeholderApplicantEmail`) rather than a real personal address.
 * Synthetic identities are stable dedup keys only: they must never be mailed
 * to and must never be persisted into `user.personal_email`.
 * @param identity - Normalized hire identity string.
 * @returns True for the synthetic fallback shape, false for real addresses.
 */
export function isSyntheticHireIdentity(identity: string): boolean {
  return SYNTHETIC_HIRE_IDENTITY_PATTERN.test(identity.trim().toLowerCase());
}
