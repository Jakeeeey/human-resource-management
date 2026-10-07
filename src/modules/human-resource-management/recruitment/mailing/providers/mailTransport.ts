import nodemailer, { type Transporter } from "nodemailer";

// Mail transport factory (server-only — nodemailer + process.env, never imported client-side).
//
// Reads process.env AT CALL TIME (never cached at module scope) so credential
// rotation applies without a redeploy. Env is asserted by NAME only; every log
// line passes through redact()/logRedacted so secret VALUES never reach logs,
// outbox rows, or evidence files.

/** Env keys whose VALUES must never appear in logs, errors, or responses. */
const SECRET_KEY_PATTERN = /PASS|TOKEN|SECRET/i;

const REDACTED = "[REDACTED]";

/** Primary transport env NAMES (frozen contract — Appendix Env row). */
export const PRIMARY_ENV_NAMES = [
    "MAIL_HOST",
    "MAIL_PORT",
    "MAIL_USER",
    "MAIL_PASS",
    "MAIL_FROM_EMAIL",
] as const;

/** Fallback transport env NAMES (all-or-nothing — Appendix Env row). */
export const FALLBACK_ENV_NAMES = [
    "MAIL_FALLBACK_ENABLED",
    "MAIL_FALLBACK_HOST",
    "MAIL_FALLBACK_PORT",
    "MAIL_FALLBACK_USER",
    "MAIL_FALLBACK_PASS",
] as const;

export interface MailConfigStatus {
    /** True when every PRIMARY_ENV_NAMES entry is non-empty. */
    configured: boolean;
    /** True when the mailer cannot send right now (inverse of configured). */
    degraded: boolean;
    /** Missing env NAMES only — never values. */
    missing: string[];
    /** MAIL_DRY_RUN !== "false" (default true). */
    dryRun: boolean;
    /** MAIL_RATE_PER_MINUTE parsed, default 20. */
    ratePerMinute: number;
    /** True when fallback is enabled AND all fallback NAMES are present. */
    fallbackAvailable: boolean;
}

export interface MailTransportResult {
    transporter: Transporter;
    /** Which leg survived verify(): primary preferred, fallback on primary failure. */
    mode: "primary" | "fallback";
    dryRun: boolean;
    ratePerMinute: number;
}

/**
 * Replaces the value of any key matching /PASS|TOKEN|SECRET/i with
 * "[REDACTED]". Handles plain objects, arrays, and Error instances;
 * primitives pass through unchanged. Never throws.
 */
export function redact<T>(value: T): T {
    try {
        if (value instanceof Error) {
            const scrubbed = new Error(scrubSecretsFromText(value.message));
            scrubbed.name = value.name;
            return scrubbed as T;
        }
        if (Array.isArray(value)) {
            return value.map((item) => redact(item)) as T;
        }
        if (value !== null && typeof value === "object") {
            const out: Record<string, unknown> = {};
            for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
                out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redact(entry);
            }
            return out as T;
        }
        return value;
    } catch {
        return REDACTED as T;
    }
}

/**
 * Strips accidental secret material from free text (defence in depth —
 * nodemailer error strings can echo server responses). Never throws.
 */
export function scrubSecretsFromText(text: string): string {
    if (typeof text !== "string") return "";
    // Never echo env values: drop anything after a credential-ish key prefix.
    return text
        .replace(/(PASS|TOKEN|SECRET)\s*[:=]\s*\S+/gi, `$1=${REDACTED}`)
        .slice(0, 500);
}

/**
 * Logs with secret VALUES stripped (names are fine). Use for every mail log line.
 */
export function logRedacted(...args: unknown[]): void {
    console.error(...args.map((arg) => redact(arg)));
}

function readEnv(name: string): string {
    return (process.env[name] ?? "").trim();
}

function missingNames(names: readonly string[]): string[] {
    return names.filter((name) => readEnv(name) === "");
}

function parseRatePerMinute(): number {
    const raw = Number.parseInt(readEnv("MAIL_RATE_PER_MINUTE"), 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

interface SmtpOptions {
    host: string;
    port: number;
    secure: boolean;
    requireTLS: boolean;
    user: string;
    pass: string;
}

/**
 * Maps port + secure flag to nodemailer TLS semantics (Appendix Env row):
 * 587+tls -> secure:false + requireTLS:true; 465+ssl -> secure:true.
 */
function buildSmtpOptions(kind: "primary" | "fallback"): SmtpOptions | null {
    const prefix = kind === "primary" ? "MAIL_" : "MAIL_FALLBACK_";
    const host = readEnv(`${prefix}HOST`);
    const portRaw = readEnv(`${prefix}PORT`);
    const user = readEnv(`${prefix}USER`);
    const pass = readEnv(`${prefix}PASS`);
    if (!host || !portRaw || !user || !pass) return null;
    const port = Number.parseInt(portRaw, 10);
    if (!Number.isFinite(port) || port <= 0) return null;
    const secureFlag = readEnv(kind === "primary" ? "MAIL_SECURE" : "MAIL_FALLBACK_SECURE");
    if (secureFlag === "true") {
        return { host, port, secure: true, requireTLS: false, user, pass };
    }
    if (secureFlag === "false") {
        return { host, port, secure: false, requireTLS: true, user, pass };
    }
    // Port-derived default: 465 = implicit TLS, anything else = STARTTLS.
    if (port === 465) {
        return { host, port, secure: true, requireTLS: false, user, pass };
    }
    return { host, port, secure: false, requireTLS: true, user, pass };
}

function createVerifiedTransport(options: SmtpOptions): Transporter {
    const transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        requireTLS: options.requireTLS,
        auth: { user: options.user, pass: options.pass },
    });
    return transporter;
}

/**
 * Names-only config probe for reuse by health/dispatch (todo 4/10).
 * Reads process.env fresh on every call. Returns NAMES, never values.
 */
export function getMailConfigStatus(): MailConfigStatus {
    const missing = missingNames(PRIMARY_ENV_NAMES);
    const fallbackMissing = missingNames(FALLBACK_ENV_NAMES);
    const fallbackEnabled = readEnv("MAIL_FALLBACK_ENABLED") === "true";
    const configured = missing.length === 0;
    return {
        configured,
        degraded: !configured,
        missing,
        dryRun: readEnv("MAIL_DRY_RUN") !== "false",
        ratePerMinute: parseRatePerMinute(),
        fallbackAvailable: fallbackEnabled && fallbackMissing.length === 0,
    };
}

/**
 * Builds a verified nodemailer transport. Reads env fresh per call.
 *
 * Primary first; on primary failure logs a REDACTED line and tries the
 * fallback ONCE (only when every MAIL_FALLBACK_* NAME is set and
 * MAIL_FALLBACK_ENABLED === "true"). Both legs failing throws a sanitized
 * Error carrying NAMES only — the caller (dispatchMail, todo 10) converts it
 * to a failed/skipped outbox outcome. Never sends mail itself.
 */
export async function getMailTransport(): Promise<MailTransportResult> {
    const dryRun = readEnv("MAIL_DRY_RUN") !== "false";
    const ratePerMinute = parseRatePerMinute();

    const primary = buildSmtpOptions("primary");
    if (!primary) {
        const missing = missingNames(PRIMARY_ENV_NAMES);
        logRedacted("[mailTransport] primary not configured, missing:", missing);
        throw new Error(
            `MAIL_TRANSPORT_UNCONFIGURED: missing ${missing.join(", ") || "unknown"}. ` +
                "Set MAIL_* env NAMES per the mailing-module Appendix."
        );
    }

    try {
        const transporter = createVerifiedTransport(primary);
        await transporter.verify();
        return { transporter, mode: "primary", dryRun, ratePerMinute };
    } catch (primaryError) {
        logRedacted("[mailTransport] primary verify failed:", primaryError);

        const fallbackEnabled = readEnv("MAIL_FALLBACK_ENABLED") === "true";
        const fallbackMissing = missingNames(FALLBACK_ENV_NAMES);
        if (!fallbackEnabled || fallbackMissing.length > 0) {
            throw new Error(
                "MAIL_TRANSPORT_UNAVAILABLE: primary verify failed and no fallback " +
                    `is configured (fallback missing: ${fallbackMissing.join(", ") || "disabled"}).`
            );
        }

        const fallback = buildSmtpOptions("fallback");
        if (!fallback) {
            throw new Error(
                "MAIL_TRANSPORT_UNAVAILABLE: primary verify failed and fallback " +
                    "options are invalid (names present but PORT not numeric)."
            );
        }

        try {
            const transporter = createVerifiedTransport(fallback);
            await transporter.verify();
            logRedacted("[mailTransport] fallback verify succeeded (names only).");
            return { transporter, mode: "fallback", dryRun, ratePerMinute };
        } catch (fallbackError) {
            logRedacted("[mailTransport] fallback verify failed:", fallbackError);
            throw new Error(
                "MAIL_TRANSPORT_UNAVAILABLE: primary and fallback verify both failed. " +
                    "Check MAIL_HOST/MAIL_PORT and MAIL_FALLBACK_HOST/MAIL_FALLBACK_PORT reachability."
            );
        }
    }
}
