export interface EmployeeEmails {
    readonly personal_email?: unknown;
    readonly user_email?: unknown;
}

export function normalizeDirectoryEmail(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const email = value.trim().toLowerCase();
    return email === "" ? null : email;
}

export function directoryEmailDomain(email: string): string | null {
    const at = email.lastIndexOf("@");
    if (at < 0) return null;
    const domain = email.slice(at + 1).trim().toLowerCase();
    return domain === "" ? null : domain;
}

export function isPlaceholderDirectoryEmail(email: string): boolean {
    const at = email.lastIndexOf("@");
    const local = (at < 0 ? email : email.slice(0, at)).trim().toLowerCase();
    if (local.startsWith("applicant-")) return true;
    return directoryEmailDomain(email) === "no-email.invalid";
}

function usableDirectoryEmail(value: unknown): string | null {
    const email = normalizeDirectoryEmail(value);
    if (email === null) return null;
    if (isPlaceholderDirectoryEmail(email)) return null;
    return email;
}

export function resolveEmployeeEmail(input: EmployeeEmails, companyDomains: ReadonlySet<string>): string | null {
    const personal = usableDirectoryEmail(input.personal_email);
    if (personal !== null) return personal;
    const login = usableDirectoryEmail(input.user_email);
    if (login === null) return null;
    const domain = directoryEmailDomain(login);
    if (domain === null) return null;
    if (companyDomains.has(domain)) return null;
    return login;
}

export function resolveCustomerEmail(customerEmail: unknown): string | null {
    return usableDirectoryEmail(customerEmail);
}

export function extractCompanyDomain(companyEmail: unknown): string | null {
    const email = normalizeDirectoryEmail(companyEmail);
    if (email === null) return null;
    return directoryEmailDomain(email);
}
