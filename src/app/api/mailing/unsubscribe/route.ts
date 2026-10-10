import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { suppressEmailIfAbsent } from "@/modules/human-resource-management/mailing-studio/studio-suppressions/server/suppressionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveUnsubscribeSecret(): string {
    return (process.env.MAIL_UNSUBSCRIBE_SECRET ?? process.env.MAIL_INTERNAL_EMIT_TOKEN ?? "").trim();
}

function signatureFor(email: string, secret: string): string {
    return createHmac("sha256", secret).update(email, "utf8").digest("hex");
}

function signaturesEqual(presented: string, expected: string): boolean {
    const left = Buffer.from(presented, "utf8");
    const right = Buffer.from(expected, "utf8");
    if (left.length !== right.length || left.length === 0) return false;
    return timingSafeEqual(left, right);
}

function decodeUnsubscribeEmail(raw: string | null): string | null {
    if (raw === null || raw === "") return null;
    let email: string;
    try {
        email = Buffer.from(raw, "base64url").toString("utf8").trim().toLowerCase();
    } catch {
        return null;
    }
    return EMAIL_PATTERN.test(email) ? email : null;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function unsubscribePage(status: number, heading: string, message: string): NextResponse {
    const safeHeading = escapeHtml(heading);
    const safeMessage = escapeHtml(message);
    const html =
        `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1">` +
        `<title>${safeHeading}</title></head>` +
        `<body style="font-family: sans-serif; max-width: 560px; margin: 48px auto; padding: 0 16px;">` +
        `<h1>${safeHeading}</h1><p>${safeMessage}</p></body></html>`;
    return new NextResponse(html, {
        status,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}

async function handleUnsubscribe(req: NextRequest): Promise<NextResponse> {
    try {
        const secret = resolveUnsubscribeSecret();
        if (secret === "") {
            return unsubscribePage(500, "Unavailable", "Unsubscribe is temporarily unavailable. Please try again later.");
        }
        const params = req.nextUrl.searchParams;
        const email = decodeUnsubscribeEmail(params.get("e"));
        const presented = (params.get("sig") ?? "").trim();
        if (email === null || presented === "") {
            return unsubscribePage(400, "Invalid link", "This unsubscribe link is invalid or has expired.");
        }
        if (!signaturesEqual(presented, signatureFor(email, secret))) {
            return unsubscribePage(400, "Invalid link", "This unsubscribe link is invalid or has expired.");
        }
        await suppressEmailIfAbsent(email, "unsubscribed");
        return unsubscribePage(
            200,
            "Unsubscribed",
            `The address ${email} will no longer receive bulk mail from us.`
        );
    } catch {
        return unsubscribePage(500, "Something went wrong", "We could not process your request. Please try again later.");
    }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    return handleUnsubscribe(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    return handleUnsubscribe(req);
}
