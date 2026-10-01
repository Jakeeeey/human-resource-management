"use client";

import type {
    SubmitApplicationPayload,
    SubmitApplicationResult,
    UploadKind,
} from "../types";

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
