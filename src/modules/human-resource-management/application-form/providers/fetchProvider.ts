"use client";

import type {
    SubmitApplicationPayload,
    SubmitApplicationResult,
    UploadKind,
} from "../types";

// Thin client helpers for the application-form flow. Not a React context -- the
// form is a single submit, not a CRUD list.

/** Uploads one file to Directus via the server proxy; returns its UUID. */
export async function uploadApplicationFile(
    file: Blob,
    kind: UploadKind,
    filename: string
): Promise<string> {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file, filename);

    const res = await fetch("/api/hrm/application-form/upload", {
        method: "POST",
        body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.error || "File upload failed");
    }
    const id = body?.data?.id;
    if (!id) throw new Error("Upload succeeded but no file id was returned");
    return id as string;
}

/** Submits the application; returns the new applicant + application ids. */
export async function submitApplication(
    payload: SubmitApplicationPayload
): Promise<SubmitApplicationResult> {
    const res = await fetch("/api/hrm/application-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(body?.error || "Failed to submit the application");
    }
    return body as SubmitApplicationResult;
}

/**
 * The quiz this form should continue into. If `overrideQuizId` is given (the
 * Quiz Management "Start" button opened this form via ?quiz_id=<that row>'s
 * id), it's used directly -- as long as that quiz still exists and is active.
 * Otherwise falls back to the single active quiz flagged `is_applicant_quiz`
 * (the walk-in-off-the-sidebar case, where no specific quiz was picked).
 * Resolves the TINYINT(1) flag in code (lesson 352).
 */
export async function resolveTargetQuizId(overrideQuizId: number | null): Promise<number | null> {
    const res = await fetch("/api/hrm/quiz-file-management/quiz-management", {
        cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const quizzes: { id: number; status: string; is_applicant_quiz: unknown }[] =
        body?.quizzes || [];

    if (overrideQuizId != null) {
        const match = quizzes.find((q) => q.id === overrideQuizId && q.status === "active");
        return match ? match.id : null;
    }

    const flagged = quizzes.find(
        (q) =>
            (q.is_applicant_quiz === true || q.is_applicant_quiz === 1) &&
            q.status === "active"
    );
    return flagged ? flagged.id : null;
}
