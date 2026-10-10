import { createHmac } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveUnsubscribeSecret(): string {
    return (process.env.MAIL_UNSUBSCRIBE_SECRET ?? process.env.MAIL_INTERNAL_EMIT_TOKEN ?? "").trim();
}

export function resolveUnsubscribeBaseUrl(fallbackBaseUrl?: string): string {
    const configured = (process.env.MAIL_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
    if (configured !== "") return configured;
    const fallback = (fallbackBaseUrl ?? "").trim().replace(/\/+$/, "");
    return fallback;
}

export function unsubscribeSignatureFor(normalisedEmail: string, secret: string): string {
    return createHmac("sha256", secret).update(normalisedEmail, "utf8").digest("hex");
}

export function buildBulkUnsubscribeUrl(email: string, fallbackBaseUrl?: string): string | null {
    const normalised = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalised)) return null;
    const secret = resolveUnsubscribeSecret();
    if (secret === "") return null;
    const base = resolveUnsubscribeBaseUrl(fallbackBaseUrl);
    if (base === "") return null;
    const e = Buffer.from(normalised, "utf8").toString("base64url");
    const sig = unsubscribeSignatureFor(normalised, secret);
    return `${base}/api/mailing/unsubscribe?e=${e}&sig=${sig}`;
}
